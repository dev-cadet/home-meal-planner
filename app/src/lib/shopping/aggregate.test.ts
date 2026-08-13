import { describe, expect, it } from "bun:test";

import {
  aggregate,
  formatItem,
  formatShoppingText,
  type IngredientLine,
} from "./aggregate";

const line = (quantity: number, unit: string, name: string): IngredientLine => ({
  quantity,
  unit,
  name,
});

/** Compact view of the result, for readable assertions. */
const render = (lines: IngredientLine[], system?: "metric" | "imperial") =>
  aggregate(lines, system).map(formatItem);

describe("summation within a dimension", () => {
  it("adds identical units", () => {
    expect(render([line(200, "g", "beef"), line(300, "g", "beef")])).toEqual([
      "500g beef",
    ]);
  });

  it("adds across compatible units and promotes the result", () => {
    expect(render([line(500, "g", "beef"), line(0.5, "kg", "beef")])).toEqual([
      "1kg beef",
    ]);
  });

  it("adds volumes", () => {
    expect(
      render([line(400, "ml", "coconut milk"), line(400, "ml", "coconut milk")]),
    ).toEqual(["800ml coconut milk"]);
  });

  it("promotes to litres past 1000ml", () => {
    expect(render([line(600, "ml", "stock"), line(700, "ml", "stock")])).toEqual([
      "1.3l stock",
    ]);
  });

  it("adds spoons into millilitres", () => {
    // 3 tsp == 1 tbsp, so this is 2 tbsp ≈ 29.57ml
    const [only] = aggregate([line(1, "tbsp", "oil"), line(3, "tsp", "oil")]);
    expect(only!.measures).toHaveLength(1);
    expect(only!.measures[0]!.unit).toBe("ml");
    expect(only!.measures[0]!.quantity).toBeCloseTo(29.57, 1);
  });
});

describe("name normalisation", () => {
  it("merges regardless of case and spacing", () => {
    expect(
      render([
        line(100, "g", "Green Beans"),
        line(150, "g", "green beans"),
        line(50, "g", "  green   beans  "),
      ]),
    ).toEqual(["300g Green Beans"]);
  });

  it("keeps the first-seen casing for display", () => {
    const [item] = aggregate([line(1, "g", "Basmati Rice"), line(1, "g", "basmati rice")]);
    expect(item!.name).toBe("Basmati Rice");
  });

  it("keeps genuinely different ingredients apart", () => {
    expect(render([line(1, "piece", "onion"), line(1, "piece", "garlic")])).toEqual([
      "1 garlic",
      "1 onion",
    ]);
  });
});

/**
 * The "don't fake it" rule from docs/plan.md §6. Merging these would need a
 * density for onions, and a guessed one produces a quietly wrong list.
 */
describe("mixed dimensions", () => {
  it("keeps mass and count as separate measures on one item", () => {
    expect(render([line(2, "piece", "onions"), line(200, "g", "onions")])).toEqual([
      "onions — 200g and 2",
    ]);
  });

  it("keeps mass and volume apart", () => {
    expect(render([line(100, "g", "milk"), line(200, "ml", "milk")])).toEqual([
      "milk — 100g and 200ml",
    ]);
  });

  it("keeps different countable units apart", () => {
    expect(
      render([line(3, "clove", "garlic"), line(1, "piece", "garlic")]),
    ).toEqual(["garlic — 3 cloves and 1"]);
  });

  it("orders measures mass, then volume, then count", () => {
    const [item] = aggregate([
      line(1, "piece", "thing"),
      line(200, "ml", "thing"),
      line(100, "g", "thing"),
    ]);
    expect(item!.measures.map((m) => m.unit)).toEqual(["g", "ml", "piece"]);
  });

  it("still sums within each dimension while keeping them apart", () => {
    expect(
      render([
        line(100, "g", "onions"),
        line(100, "g", "onions"),
        line(1, "piece", "onions"),
        line(2, "piece", "onions"),
      ]),
    ).toEqual(["onions — 200g and 3"]);
  });
});

describe("ordering and edge cases", () => {
  it("sorts alphabetically, case-insensitively", () => {
    expect(
      render([line(1, "g", "Zucchini"), line(1, "g", "apple"), line(1, "g", "Beef")]),
    ).toEqual(["1g apple", "1g Beef", "1g Zucchini"]);
  });

  it("returns nothing for no input", () => {
    expect(aggregate([])).toEqual([]);
  });

  it("skips blank names and non-positive quantities", () => {
    expect(
      render([
        line(1, "g", "   "),
        line(0, "g", "nothing"),
        line(-5, "g", "negative"),
        line(Number.NaN, "g", "nan"),
        line(2, "g", "real"),
      ]),
    ).toEqual(["2g real"]);
  });

  it("rounds float noise out of the result", () => {
    expect(render([line(0.1, "kg", "flour"), line(0.2, "kg", "flour")])).toEqual([
      "300g flour",
    ]);
  });

  it("renders imperial when asked", () => {
    expect(render([line(1, "lb", "beef")], "imperial")).toEqual(["1lb beef"]);
  });
});

/**
 * A hand-worked example. Every figure below was calculated by hand from the
 * three meals, and the UI is separately checked against the same numbers.
 *
 *   Thai green curry : 400ml coconut milk, 500g chicken, 3 cloves garlic
 *   Red lentil dhal  : 400ml coconut milk, 300g red lentils, 3 cloves garlic,
 *                      1 onion
 *   Bolognese        : 0.5kg beef mince, 2 onions, 200g onions (for the sauce)
 *
 *   coconut milk : 400 + 400          = 800ml
 *   garlic       : 3 + 3              = 6 cloves
 *   onions       : 1 + 2 pieces       = 3, and 200g  -> two measures
 *   beef mince   : 0.5kg              = 500g
 *   chicken      : 500g
 *   red lentils  : 300g
 */
describe("hand-worked example", () => {
  const MEALS: IngredientLine[] = [
    line(400, "ml", "coconut milk"),
    line(500, "g", "chicken thigh"),
    line(3, "clove", "garlic"),

    line(400, "ml", "coconut milk"),
    line(300, "g", "red lentils"),
    line(3, "clove", "garlic"),
    line(1, "piece", "onions"),

    line(0.5, "kg", "beef mince"),
    line(2, "piece", "onions"),
    line(200, "g", "onions"),
  ];

  it("produces exactly the expected list", () => {
    expect(render(MEALS)).toEqual([
      "500g beef mince",
      "500g chicken thigh",
      "800ml coconut milk",
      "6 cloves garlic",
      "onions — 200g and 3",
      "300g red lentils",
    ]);
  });

  it("formats cleanly as plain text", () => {
    const text = formatShoppingText(aggregate(MEALS), "Shopping list — Weeknights");

    expect(text).toBe(
      [
        "Shopping list — Weeknights",
        "",
        "- 500g beef mince",
        "- 500g chicken thigh",
        "- 800ml coconut milk",
        "- 6 cloves garlic",
        "- onions — 200g and 3",
        "- 300g red lentils",
      ].join("\n"),
    );
  });

  it("has no markdown or stray characters that would look odd in a notes app", () => {
    const text = formatShoppingText(aggregate(MEALS), "Shopping list");
    expect(text).not.toMatch(/[*_#|`]/);
    expect(text).not.toMatch(/\n{3,}/);
    expect(text.endsWith("\n")).toBe(false);
  });
});

describe("formatShoppingText", () => {
  it("says so when there is nothing to buy", () => {
    expect(formatShoppingText([], "Shopping list")).toBe(
      "Shopping list\n\n(nothing to buy)",
    );
  });
});

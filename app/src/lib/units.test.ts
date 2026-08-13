import { describe, expect, it } from "bun:test";

import {
  formatMeasure,
  fromBase,
  groupKey,
  isUnit,
  toBase,
  UNIT_CODES,
  unitOf,
} from "./units";

describe("unit lookup", () => {
  it("recognises every declared code", () => {
    for (const code of UNIT_CODES) expect(isUnit(code)).toBe(true);
  });

  it("rejects unknown codes", () => {
    expect(isUnit("furlong")).toBe(false);
    expect(() => unitOf("furlong")).toThrow(/furlong/);
  });
});

describe("conversion to base units", () => {
  it("converts mass to grams", () => {
    expect(toBase(1, "kg")).toBe(1000);
    expect(toBase(2, "lb")).toBeCloseTo(907.18474, 4);
    expect(toBase(16, "oz")).toBeCloseTo(453.59237, 4);
  });

  it("converts volume to millilitres", () => {
    expect(toBase(1, "l")).toBe(1000);
    expect(toBase(3, "tsp")).toBeCloseTo(14.78676, 4);
    expect(toBase(1, "cup")).toBeCloseTo(236.58824, 4);
  });

  it("treats counts as themselves", () => {
    expect(toBase(3, "clove")).toBe(3);
  });
});

describe("fromBase", () => {
  it("promotes to the largest unit that stays >= 1", () => {
    expect(fromBase(1200, "mass")).toEqual({ quantity: 1.2, unit: "kg" });
    expect(fromBase(800, "mass")).toEqual({ quantity: 800, unit: "g" });
    expect(fromBase(1500, "volume")).toEqual({ quantity: 1.5, unit: "l" });
  });

  it("falls back to the smallest unit below the ladder", () => {
    expect(fromBase(0.5, "mass")).toEqual({ quantity: 0.5, unit: "g" });
  });

  it("renders imperial when asked", () => {
    expect(fromBase(453.59237, "mass", "imperial")).toEqual({
      quantity: 1,
      unit: "lb",
    });
  });

  it("keeps the count unit it was given", () => {
    expect(fromBase(3, "count", "metric", "clove")).toEqual({
      quantity: 3,
      unit: "clove",
    });
  });
});

/**
 * The rule that keeps shopping lists honest: things only merge when merging
 * is actually meaningful.
 */
describe("groupKey", () => {
  it("merges the same ingredient across compatible units", () => {
    expect(groupKey("Beef mince", "g")).toBe(groupKey("beef mince", "kg"));
    expect(groupKey("Milk", "ml")).toBe(groupKey("milk", "l"));
  });

  it("normalises whitespace and case", () => {
    expect(groupKey("  Green   Beans ", "g")).toBe(groupKey("green beans", "g"));
  });

  it("keeps different ingredients apart", () => {
    expect(groupKey("onion", "g")).not.toBe(groupKey("garlic", "g"));
  });

  it("does not merge mass with volume", () => {
    expect(groupKey("milk", "g")).not.toBe(groupKey("milk", "ml"));
  });

  /** 3 cloves + 3 slices is not 6 of anything. */
  it("does not merge different countable units", () => {
    expect(groupKey("garlic", "clove")).not.toBe(groupKey("garlic", "piece"));
    expect(groupKey("bread", "slice")).not.toBe(groupKey("bread", "piece"));
  });

  it("does not merge counts with mass", () => {
    expect(groupKey("onion", "piece")).not.toBe(groupKey("onion", "g"));
  });
});

describe("formatMeasure", () => {
  it("renders mass and volume tight against the unit", () => {
    expect(formatMeasure({ quantity: 200, unit: "g" })).toBe("200g");
    expect(formatMeasure({ quantity: 1.5, unit: "l" })).toBe("1.5l");
  });

  it("renders bare numbers for pieces", () => {
    expect(formatMeasure({ quantity: 2, unit: "piece" })).toBe("2");
  });

  it("pluralises other countables", () => {
    expect(formatMeasure({ quantity: 1, unit: "clove" })).toBe("1 clove");
    expect(formatMeasure({ quantity: 3, unit: "clove" })).toBe("3 cloves");
  });

  it("rounds away float noise", () => {
    expect(formatMeasure({ quantity: 0.1 + 0.2, unit: "kg" })).toBe("0.3kg");
  });
});

import { describe, expect, it } from "bun:test";

import { normalizeTagNames } from "./normalize";

describe("normalizeTagNames", () => {
  it("trims whitespace and drops blanks", () => {
    expect(normalizeTagNames(["  vegan  ", "", "   ", "quick"])).toEqual([
      "vegan",
      "quick",
    ]);
  });

  it("de-dupes case-insensitively, keeping the first casing seen", () => {
    expect(normalizeTagNames(["Vegan", "vegan", "VEGAN"])).toEqual(["Vegan"]);
  });

  it("caps an individual tag at 40 characters", () => {
    const long = "x".repeat(60);
    expect(normalizeTagNames([long])[0]).toHaveLength(40);
  });

  it("caps the list at 20 tags", () => {
    const many = Array.from({ length: 30 }, (_, i) => `tag-${i}`);
    expect(normalizeTagNames(many)).toHaveLength(20);
  });
});

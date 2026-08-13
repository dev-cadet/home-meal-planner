import { describe, expect, test } from "bun:test";

import { resolvePaletteId } from "./resolve";

describe("resolvePaletteId", () => {
  test("falls back to the default with no cookies at all", () => {
    expect(resolvePaletteId({}, "2026-06-15")).toBe("default");
  });

  test("an invalid standard palette cookie falls back to the default", () => {
    expect(resolvePaletteId({ palette: "not-a-real-palette" }, "2026-06-15")).toBe("default");
  });

  test("a valid standard palette cookie wins over the default", () => {
    expect(resolvePaletteId({ palette: "dracula" }, "2026-06-15")).toBe("dracula");
  });

  test("an active festive holiday wins over the standard palette cookie", () => {
    expect(
      resolvePaletteId({ palette: "nord", festiveEnabled: "true" }, "2026-10-15"),
    ).toBe("halloween");
  });

  test("festive theming enabled but no holiday active falls through to the standard cookie", () => {
    expect(
      resolvePaletteId({ palette: "gruvbox", festiveEnabled: "true" }, "2026-06-15"),
    ).toBe("gruvbox");
  });

  test("an opted-out holiday is skipped even while active", () => {
    expect(
      resolvePaletteId(
        { palette: "nord", festiveEnabled: "true", festiveOptOut: "halloween" },
        "2026-10-15",
      ),
    ).toBe("nord");
  });
});

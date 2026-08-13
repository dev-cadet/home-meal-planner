import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { DEFAULT_STANDARD_PALETTE_ID, FESTIVE_PALETTES, STANDARD_PALETTES } from "./palettes";

/**
 * `STANDARD_PALETTES`/`FESTIVE_PALETTES` (this file) and the
 * `[data-palette="id"]` blocks (`app/palettes.css`) are two hand-maintained
 * lists with nothing else tying them together — add a palette to one and
 * forget the other, and the UI just silently falls back to Default. This
 * test is that missing link, checked in both directions: every registry id
 * needs a block, and every block needs to belong to a registered id (this
 * codebase has already dropped festive holidays twice without always
 * remembering to delete their CSS alongside them).
 */
const css = readFileSync(join(import.meta.dir, "../../app/palettes.css"), "utf-8");
// Strip comments first — the file's own header comment uses `data-palette="id"`
// as a literal example, which would otherwise read as a bogus registered id.
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

const cssDataPaletteIds = new Set(
  Array.from(cssWithoutComments.matchAll(/data-palette="([^"]+)"/g), (m) => m[1]),
);

describe("palette registry matches palettes.css", () => {
  test("every non-default standard palette has a CSS block", () => {
    for (const palette of STANDARD_PALETTES) {
      if (palette.id === DEFAULT_STANDARD_PALETTE_ID) continue; // lives in globals.css's @theme instead
      expect(cssDataPaletteIds.has(palette.id)).toBe(true);
    }
  });

  test("every festive palette has a CSS block", () => {
    for (const palette of FESTIVE_PALETTES) {
      expect(cssDataPaletteIds.has(palette.id)).toBe(true);
    }
  });

  test("every CSS block belongs to a registered palette id", () => {
    const registeredIds = new Set([
      ...STANDARD_PALETTES.map((p) => p.id),
      ...FESTIVE_PALETTES.map((p) => p.id),
    ]);
    for (const id of cssDataPaletteIds) {
      expect(registeredIds.has(id)).toBe(true);
    }
  });
});

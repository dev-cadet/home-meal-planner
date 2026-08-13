export interface StandardPalette {
  id: string;
  label: string;
}

export interface FestivePalette {
  id: string;
  label: string;
  /** The calendar month (1-12) this holiday's palette applies in. Each month may only map to one festive palette — see `festive.test.ts`. */
  month: number;
}

/**
 * The Standard collection: a flat list of named palettes picked explicitly
 * in Settings — no light/dark switching concept, just a list to choose from.
 * "Default" doubles as the base `@theme` values in `globals.css` (so it's
 * also what renders before any `data-palette` override matches), which is
 * why it has no block of its own in `app/palettes.css` — every other id
 * here needs one.
 */
export const STANDARD_PALETTES: StandardPalette[] = [
  { id: "default", label: "Default" },
  { id: "dracula", label: "Dracula" },
  { id: "nord", label: "Nord" },
  { id: "gruvbox", label: "Gruvbox" },
  { id: "rose-pine", label: "Rosé Pine" },
  { id: "tokyo-night", label: "Tokyo Night" },
];

export const DEFAULT_STANDARD_PALETTE_ID = "default";

/**
 * The Festive collection: one palette per calendar holiday, active during
 * its whole month. Reduced to two for now — more can be added later, as
 * long as no two share a month. Each id must have a matching
 * `[data-palette="id"]` block in `app/palettes.css`.
 */
export const FESTIVE_PALETTES: FestivePalette[] = [
  { id: "halloween", label: "Halloween", month: 10 },
  { id: "christmas", label: "Christmas", month: 12 },
];

export function isStandardPaletteId(value: string): boolean {
  return STANDARD_PALETTES.some((p) => p.id === value);
}

export function isFestivePaletteId(value: string): boolean {
  return FESTIVE_PALETTES.some((p) => p.id === value);
}

/**
 * Ingredient units.
 *
 * Names are free text; units are constrained. That pairing is what makes a
 * shopping list aggregatable without maintaining a master ingredient
 * catalogue (docs/plan.md §4).
 */

export type Dimension = "mass" | "volume" | "count";

export type System = "metric" | "imperial";

export interface UnitDef {
  code: string;
  /** Shown in the picker. */
  label: string;
  dimension: Dimension;
  /** Multiplier into the dimension's base unit. */
  toBase: number;
  /** Which systems offer this unit when *entering* an ingredient. */
  system: System | "both";
  /**
   * Which systems may *render* an aggregated total in this unit.
   *
   * Distinct from `system` on purpose. Spoons are perfectly good input units
   * in a metric kitchen, but they must never be chosen to display a total:
   * ranked purely by size they sit between ml and l, so 800ml would render as
   * "54.1tbsp". Input vocabulary and output vocabulary are different things.
   */
  displayIn: readonly System[];
}

export const UNITS: readonly UnitDef[] = [
  // mass — base: gram
  { code: "g", label: "g", dimension: "mass", toBase: 1, system: "metric", displayIn: ["metric"] },
  { code: "kg", label: "kg", dimension: "mass", toBase: 1000, system: "metric", displayIn: ["metric"] },
  { code: "oz", label: "oz", dimension: "mass", toBase: 28.349523125, system: "imperial", displayIn: ["imperial"] },
  { code: "lb", label: "lb", dimension: "mass", toBase: 453.59237, system: "imperial", displayIn: ["imperial"] },

  // volume — base: millilitre
  { code: "ml", label: "ml", dimension: "volume", toBase: 1, system: "metric", displayIn: ["metric"] },
  { code: "l", label: "l", dimension: "volume", toBase: 1000, system: "metric", displayIn: ["metric"] },
  { code: "tsp", label: "tsp", dimension: "volume", toBase: 4.92892159375, system: "both", displayIn: ["imperial"] },
  { code: "tbsp", label: "tbsp", dimension: "volume", toBase: 14.78676478125, system: "both", displayIn: ["imperial"] },
  { code: "cup", label: "cup", dimension: "volume", toBase: 236.5882365, system: "imperial", displayIn: ["imperial"] },

  // count — each of these is its own group; see groupKey below
  { code: "piece", label: "piece", dimension: "count", toBase: 1, system: "both", displayIn: ["metric", "imperial"] },
  { code: "clove", label: "clove", dimension: "count", toBase: 1, system: "both", displayIn: ["metric", "imperial"] },
  { code: "slice", label: "slice", dimension: "count", toBase: 1, system: "both", displayIn: ["metric", "imperial"] },
  { code: "pinch", label: "pinch", dimension: "count", toBase: 1, system: "both", displayIn: ["metric", "imperial"] },
];

const BY_CODE = new Map(UNITS.map((u) => [u.code, u]));

export function isUnit(code: string): boolean {
  return BY_CODE.has(code);
}

export function unitOf(code: string): UnitDef {
  const unit = BY_CODE.get(code);
  if (!unit) throw new Error(`Unknown unit "${code}"`);
  return unit;
}

export const UNIT_CODES: readonly string[] = UNITS.map((u) => u.code);

/**
 * The key two ingredient lines must share to be summed together.
 *
 * Mass and volume convert freely within themselves, so the dimension alone is
 * enough. Countable units do **not**: three cloves and three slices are not
 * six of anything, so each keeps its own bucket. Merging them would produce a
 * quietly wrong shopping list, which is worse than two adjacent lines.
 */
export function groupKey(name: string, unitCode: string): string {
  const unit = unitOf(unitCode);
  const normalised = name.trim().toLowerCase().replace(/\s+/g, " ");
  const bucket =
    unit.dimension === "count" ? `count:${unit.code}` : unit.dimension;
  return `${normalised} ${bucket}`;
}

export function toBase(quantity: number, unitCode: string): number {
  return quantity * unitOf(unitCode).toBase;
}

/**
 * Display units for a dimension, largest first.
 *
 * Filtered by `displayIn`, not `system` — see the note on UnitDef.
 */
function ladder(dimension: Dimension, system: System): UnitDef[] {
  return UNITS.filter(
    (u) => u.dimension === dimension && u.displayIn.includes(system),
  ).sort((a, b) => b.toBase - a.toBase);
}

export interface Measure {
  quantity: number;
  unit: string;
}

/**
 * Render a base-unit amount in the largest unit that keeps it >= 1.
 * 1200 g becomes 1.2 kg; 800 g stays 800 g.
 */
export function fromBase(
  baseQuantity: number,
  dimension: Dimension,
  system: System = "metric",
  countUnit = "piece",
): Measure {
  if (dimension === "count") {
    return { quantity: round(baseQuantity), unit: countUnit };
  }

  const candidates = ladder(dimension, system);
  const chosen =
    candidates.find((u) => baseQuantity >= u.toBase) ?? candidates.at(-1)!;

  return { quantity: round(baseQuantity / chosen.toBase), unit: chosen.code };
}

/** Two decimals, without trailing zeros — quantities are cooking amounts. */
export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatMeasure({ quantity, unit }: Measure): string {
  const def = BY_CODE.get(unit);
  const amount = String(round(quantity));
  if (!def) return `${amount} ${unit}`;

  // "3 piece" reads badly; countables get pluralised, mass/volume do not.
  if (def.dimension === "count") {
    if (def.code === "piece") return amount;
    return `${amount} ${quantity === 1 ? def.label : `${def.label}s`}`;
  }
  return `${amount}${def.label}`;
}

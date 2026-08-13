import {
  formatMeasure,
  fromBase,
  groupKey,
  toBase,
  unitOf,
  type Dimension,
  type Measure,
} from "../units";

/**
 * Shopping-list aggregation (docs/plan.md §6).
 *
 * Pure: no database, no config, no I/O. The riskiest logic in the app gets to
 * be the easiest to test.
 *
 * Servings are deliberately ignored — quantities are taken exactly as entered
 * on the meal (docs/plan.md §1).
 */

export interface IngredientLine {
  quantity: number;
  unit: string;
  name: string;
}

/** One ingredient. Usually a single measure; more when units cannot combine. */
export interface ShoppingItem {
  /** Display name, in the casing it was first entered with. */
  name: string;
  /** Sort key: lower-cased, whitespace-collapsed. */
  key: string;
  measures: Measure[];
}

/** Mass before volume before count, so lines read consistently. */
const DIMENSION_ORDER: Record<Dimension, number> = {
  mass: 0,
  volume: 1,
  count: 2,
};

interface Bucket {
  displayName: string;
  key: string;
  dimension: Dimension;
  /** Which countable unit this bucket holds; irrelevant for mass/volume. */
  countUnit: string;
  base: number;
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Combine ingredient lines into a shopping list.
 *
 * Quantities sum only within a dimension. `2 onions` and `200g onions` share a
 * name but not a dimension, so they stay as two measures on one item rather
 * than being merged — guessing an onion's mass would produce a quietly wrong
 * list, which is worse than two adjacent lines.
 *
 * Countable units keep separate buckets from each other too: three cloves and
 * three slices are not six of anything.
 */
export function aggregate(
  lines: readonly IngredientLine[],
  system: "metric" | "imperial" = "metric",
): ShoppingItem[] {
  const buckets = new Map<string, Bucket>();

  for (const line of lines) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) continue;

    const trimmed = line.name.trim();
    if (trimmed === "") continue;

    const unit = unitOf(line.unit);
    const bucketKey = groupKey(trimmed, line.unit);

    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.base += toBase(line.quantity, line.unit);
      continue;
    }

    buckets.set(bucketKey, {
      displayName: trimmed,
      key: normaliseName(trimmed),
      dimension: unit.dimension,
      countUnit: unit.code,
      base: toBase(line.quantity, line.unit),
    });
  }

  // Collapse buckets back onto one item per ingredient name.
  const items = new Map<string, ShoppingItem & { order: Bucket[] }>();

  for (const bucket of buckets.values()) {
    let item = items.get(bucket.key);
    if (!item) {
      item = {
        name: bucket.displayName,
        key: bucket.key,
        measures: [],
        order: [],
      };
      items.set(bucket.key, item);
    }
    item.order.push(bucket);
  }

  return Array.from(items.values())
    .map(({ name, key, order }) => ({
      name,
      key,
      measures: order
        .sort(
          (a, b) =>
            DIMENSION_ORDER[a.dimension] - DIMENSION_ORDER[b.dimension] ||
            a.countUnit.localeCompare(b.countUnit),
        )
        .map((bucket) =>
          fromBase(bucket.base, bucket.dimension, system, bucket.countUnit),
        ),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** "500g beef mince", or "onions — 3 and 200g" when units cannot combine. */
export function formatItem(item: ShoppingItem): string {
  const measures = item.measures.map(formatMeasure);

  if (measures.length === 1) {
    return `${measures[0]} ${item.name}`;
  }
  return `${item.name} — ${measures.join(" and ")}`;
}

/**
 * Plain text for the clipboard and the share sheet.
 *
 * Deliberately plain: no markdown, no box drawing, no leading bullets that
 * turn into stray characters. This lands in Notes, Messages or WhatsApp, and
 * it has to look hand-written when it gets there.
 */
export function formatShoppingText(
  items: readonly ShoppingItem[],
  heading: string,
): string {
  if (items.length === 0) return `${heading}\n\n(nothing to buy)`;

  return [heading, "", ...items.map((item) => `- ${formatItem(item)}`)].join("\n");
}

import "server-only";

import { and, asc, eq, gte, lte } from "drizzle-orm";

import { requireUser } from "../auth/dal";
import type { IsoDate } from "../date";
import { getDb } from "../db/client";
import {
  meal,
  mealIngredient,
  planItem,
  scheduleEntry,
} from "../db/schema";
import type { IngredientLine } from "./aggregate";

export interface ShoppingSource {
  lines: IngredientLine[];
  /** Distinct meals contributing, in the order they appear. */
  mealNames: string[];
  /** Occurrences, which can exceed mealNames when a meal repeats. */
  occurrences: number;
}

/**
 * Ingredients for every meal in a plan.
 *
 * A plan cannot contain the same meal twice — UNIQUE(plan_id, meal_id) — so
 * occurrences and distinct meals always match here.
 */
export async function ingredientsForPlan(
  planId: string,
): Promise<ShoppingSource> {
  await requireUser();
  const db = await getDb();

  const rows = await db
    .select({
      mealName: meal.name,
      position: planItem.position,
      quantity: mealIngredient.quantity,
      unit: mealIngredient.unit,
      name: mealIngredient.name,
    })
    .from(planItem)
    .innerJoin(meal, eq(meal.id, planItem.mealId))
    .leftJoin(mealIngredient, eq(mealIngredient.mealId, meal.id))
    .where(eq(planItem.planId, planId))
    .orderBy(asc(planItem.position), asc(mealIngredient.position));

  return collect(rows);
}

/**
 * Ingredients for everything scheduled between two dates, inclusive.
 *
 * A meal scheduled on three days contributes its ingredients three times —
 * that is the point of shopping for a date range.
 */
export async function ingredientsForRange(
  from: IsoDate,
  to: IsoDate,
): Promise<ShoppingSource> {
  await requireUser();
  const db = await getDb();

  const rows = await db
    .select({
      mealName: meal.name,
      position: mealIngredient.position,
      quantity: mealIngredient.quantity,
      unit: mealIngredient.unit,
      name: mealIngredient.name,
    })
    .from(scheduleEntry)
    .innerJoin(meal, eq(meal.id, scheduleEntry.mealId))
    .leftJoin(mealIngredient, eq(mealIngredient.mealId, meal.id))
    .where(and(gte(scheduleEntry.date, from), lte(scheduleEntry.date, to)))
    .orderBy(asc(scheduleEntry.date), asc(mealIngredient.position));

  return collect(rows);
}

interface Row {
  mealName: string;
  quantity: number | null;
  unit: string | null;
  name: string | null;
}

/**
 * The LEFT JOIN keeps meals that have no ingredients, so they still appear in
 * the "from these meals" summary — a meal contributing nothing to the list is
 * worth seeing, not silently dropping.
 */
function collect(rows: Row[]): ShoppingSource {
  const lines: IngredientLine[] = [];
  const mealNames: string[] = [];
  let occurrences = 0;
  let previous: string | null = null;

  for (const row of rows) {
    if (row.mealName !== previous) {
      previous = row.mealName;
      occurrences += 1;
      if (!mealNames.includes(row.mealName)) mealNames.push(row.mealName);
    }

    if (row.quantity !== null && row.unit !== null && row.name !== null) {
      lines.push({ quantity: row.quantity, unit: row.unit, name: row.name });
    }
  }

  return { lines, mealNames, occurrences };
}

import { asc, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { planItem } from "../db/schema";

/**
 * Plan ordering, kept free of `"use server"` and auth so it can be tested
 * directly against a real database.
 */

/**
 * Rewrite a plan's ordering.
 *
 * `plan_item` carries UNIQUE(plan_id, position), so shuffling with in-place
 * updates collides the instant two rows briefly share a position. Wiping the
 * rows and reinserting in the desired order sidesteps that, and the
 * transaction means a mid-flight failure cannot leave a plan half-ordered.
 *
 * Item ids are regenerated, which is harmless — nothing references them.
 */
export async function setPlanOrder(
  db: Database,
  planId: string,
  orderedMealIds: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(planItem).where(eq(planItem.planId, planId));
    if (orderedMealIds.length === 0) return;

    await tx
      .insert(planItem)
      .values(orderedMealIds.map((mealId, position) => ({ planId, mealId, position })));
  });
}

export async function currentOrder(
  db: Database,
  planId: string,
): Promise<string[]> {
  const rows = await db
    .select({ mealId: planItem.mealId })
    .from(planItem)
    .where(eq(planItem.planId, planId))
    .orderBy(asc(planItem.position));

  return rows.map((r) => r.mealId);
}

/** Swap one step in either direction. Out-of-range moves are a no-op. */
export function moveInOrder(
  order: readonly string[],
  id: string,
  direction: "up" | "down",
): string[] {
  const next = [...order];
  const index = next.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || target < 0 || target >= next.length) return next;

  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

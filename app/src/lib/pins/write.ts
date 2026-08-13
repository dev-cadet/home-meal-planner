import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { mealPin, planPin } from "../db/schema";

/**
 * A pin's presence is its whole state — no ownership check needed, since any
 * signed-in user may pin any shared meal/plan for themselves. Setting `true`
 * inserts (idempotently, via the composite PK); `false` deletes.
 */
export async function setMealPinned(
  db: Database,
  userId: string,
  mealId: string,
  pinned: boolean,
): Promise<void> {
  if (pinned) {
    await db.insert(mealPin).values({ userId, mealId }).onConflictDoNothing();
  } else {
    await db.delete(mealPin).where(and(eq(mealPin.userId, userId), eq(mealPin.mealId, mealId)));
  }
}

/** Same as {@link setMealPinned}, for plans. */
export async function setPlanPinned(
  db: Database,
  userId: string,
  planId: string,
  pinned: boolean,
): Promise<void> {
  if (pinned) {
    await db.insert(planPin).values({ userId, planId }).onConflictDoNothing();
  } else {
    await db.delete(planPin).where(and(eq(planPin.userId, userId), eq(planPin.planId, planId)));
  }
}

import "server-only";

import { and, asc, count, desc, eq, inArray, isNotNull, like, or, sql } from "drizzle-orm";
import { cache } from "react";

import { requireUser } from "../auth/dal";
import { getDb } from "../db/client";
import { meal, mealTag, plan, planItem, planPin, tag, user } from "../db/schema";
import { tagsByMealIds, tagsForPlansViaMeals } from "../tags/queries";

/**
 * Reads for the Plans feature.
 *
 * A plan is a playlist: an ordered, undated set of meals. It has no link to
 * the schedule — that separation is deliberate (docs/plan.md §1).
 */

/** One tile in a plan's collage cover. */
export interface PlanCoverImage {
  mealId: string;
  name: string;
  imageHash: string;
}

export interface PlanListItem {
  id: string;
  name: string;
  description: string | null;
  mealCount: number;
  /** Up to 6, in plan order, from meals that actually have a photo. */
  coverImages: PlanCoverImage[];
  /** The deduped union of this plan's meals' tags — plans carry no tags of their own. */
  tags: string[];
  pinned: boolean;
}

const MAX_COVER_IMAGES = 6;

/**
 * Cover images for a batch of plans, keyed by plan id — mirrors
 * `tagsByMealIds`. Fetches every photographed meal in these plans in plan
 * order and caps each plan's list to {@link MAX_COVER_IMAGES} in JS, rather
 * than a per-group SQL limit SQLite doesn't have a plain way to express.
 */
async function coverImagesByPlanIds(
  db: Awaited<ReturnType<typeof getDb>>,
  planIds: string[],
): Promise<Map<string, PlanCoverImage[]>> {
  const map = new Map<string, PlanCoverImage[]>();
  if (planIds.length === 0) return map;

  const rows = await db
    .select({
      planId: planItem.planId,
      mealId: meal.id,
      name: meal.name,
      imageHash: meal.imageHash,
    })
    .from(planItem)
    .innerJoin(meal, eq(meal.id, planItem.mealId))
    .where(and(inArray(planItem.planId, planIds), isNotNull(meal.imageHash)))
    .orderBy(asc(planItem.planId), asc(planItem.position));

  for (const row of rows) {
    const existing = map.get(row.planId) ?? [];
    if (existing.length < MAX_COVER_IMAGES) {
      existing.push({ mealId: row.mealId, name: row.name, imageHash: row.imageHash! });
    }
    map.set(row.planId, existing);
  }
  return map;
}

export async function listPlans(
  search?: string,
  tags?: string[],
): Promise<PlanListItem[]> {
  const viewer = await requireUser();
  const db = await getDb();

  const term = search?.trim();
  const textFilter = term
    ? or(
        like(plan.name, `%${term}%`),
        like(sql`coalesce(${plan.description}, '')`, `%${term}%`),
      )
    : undefined;

  // A plan matches if its meals, collectively, carry every requested tag —
  // narrows, not widens. Plans have no tags of their own (see tagsForPlansViaMeals).
  const activeTags = (tags ?? []).filter((t) => t.trim() !== "");
  const matchingIds =
    activeTags.length > 0
      ? db
          .select({ id: planItem.planId })
          .from(planItem)
          .innerJoin(mealTag, eq(mealTag.mealId, planItem.mealId))
          .innerJoin(tag, eq(tag.id, mealTag.tagId))
          .where(inArray(tag.name, activeTags))
          .groupBy(planItem.planId)
          .having(sql`count(distinct ${tag.name}) = ${activeTags.length}`)
      : undefined;

  const rows = await db
    .select({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      mealCount: count(planItem.id),
      pinnedByViewer: planPin.userId,
    })
    .from(plan)
    .leftJoin(planItem, eq(planItem.planId, plan.id))
    .leftJoin(planPin, and(eq(planPin.planId, plan.id), eq(planPin.userId, viewer.id)))
    .where(and(textFilter, matchingIds ? inArray(plan.id, matchingIds) : undefined))
    .groupBy(plan.id)
    .orderBy(desc(planPin.userId), asc(plan.name));

  const planIds = rows.map((r) => r.id);
  const [covers, tagsById] = await Promise.all([
    coverImagesByPlanIds(db, planIds),
    tagsForPlansViaMeals(planIds),
  ]);
  return rows.map(({ pinnedByViewer, ...r }) => ({
    ...r,
    pinned: pinnedByViewer != null,
    coverImages: covers.get(r.id) ?? [],
    tags: tagsById.get(r.id) ?? [],
  }));
}

/** Memoised so generateMetadata and the page body share one query. */
export const getPlan = cache(async (id: string) => {
  const viewer = await requireUser();
  const db = await getDb();

  const [row] = await db
    .select({ plan, createdBy: user.name })
    .from(plan)
    .leftJoin(user, eq(user.id, plan.createdById))
    .where(eq(plan.id, id));

  if (!row) return null;

  const meals = await db
    .select({
      itemId: planItem.id,
      position: planItem.position,
      id: meal.id,
      name: meal.name,
      servings: meal.servings,
      prepMins: meal.prepMins,
      cookMins: meal.cookMins,
      imageHash: meal.imageHash,
    })
    .from(planItem)
    .innerJoin(meal, eq(meal.id, planItem.mealId))
    .where(eq(planItem.planId, id))
    .orderBy(asc(planItem.position));

  const [pin] = await db
    .select({ userId: planPin.userId })
    .from(planPin)
    .where(and(eq(planPin.planId, id), eq(planPin.userId, viewer.id)));

  return { ...row.plan, createdByName: row.createdBy, meals, pinned: !!pin };
});

/** Meals not already in the plan, for the add picker. */
export async function mealsNotInPlan(planId: string) {
  await requireUser();
  const db = await getDb();

  const inPlan = db
    .select({ id: planItem.mealId })
    .from(planItem)
    .where(eq(planItem.planId, planId));

  const meals = await db
    .select({
      id: meal.id,
      name: meal.name,
      imageHash: meal.imageHash,
      servings: meal.servings,
    })
    .from(meal)
    .where(sql`${meal.id} NOT IN ${inPlan}`)
    .orderBy(asc(meal.name));

  const tagsById = await tagsByMealIds(meals.map((m) => m.id));
  return meals.map((m) => ({ ...m, tags: tagsById.get(m.id) ?? [] }));
}

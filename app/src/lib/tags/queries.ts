import "server-only";

import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { requireUser } from "../auth/dal";
import { getDb } from "../db/client";
import { mealTag, planItem, tag } from "../db/schema";

export interface TagOption {
  id: string;
  name: string;
}

/**
 * Every meal tag that exists, for the meal form's autocomplete. A tag row
 * only exists while it's attached to something — `pruneOrphanedMealTags`
 * (lib/tags/write) deletes it the moment its last association goes away —
 * so this never surfaces dead vocabulary either.
 */
export async function allMealTagNames(): Promise<string[]> {
  await requireUser();
  const db = await getDb();
  const rows = await db.select({ name: tag.name }).from(tag).orderBy(asc(tag.name));
  return rows.map((r) => r.name);
}

/**
 * The most recently used meal tags, for pre-filling the suggestion list
 * before the user has typed anything.
 */
export async function recentlyUsedMealTagNames(limit = 5): Promise<string[]> {
  await requireUser();
  const db = await getDb();
  const rows = await db
    .select({ name: tag.name })
    .from(mealTag)
    .innerJoin(tag, eq(tag.id, mealTag.tagId))
    .groupBy(tag.id)
    .orderBy(desc(sql`max(${mealTag.createdAt})`))
    .limit(limit);
  return rows.map((r) => r.name);
}

export async function tagsForMeal(mealId: string): Promise<string[]> {
  await requireUser();
  const db = await getDb();
  const rows = await db
    .select({ name: tag.name })
    .from(mealTag)
    .innerJoin(tag, eq(tag.id, mealTag.tagId))
    .where(eq(mealTag.mealId, mealId))
    .orderBy(asc(tag.name));
  return rows.map((r) => r.name);
}

/** Tags for several meals at once, keyed by meal id — for the picker sheets. */
export async function tagsByMealIds(mealIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (mealIds.length === 0) return map;

  await requireUser();
  const db = await getDb();
  const rows = await db
    .select({ mealId: mealTag.mealId, name: tag.name })
    .from(mealTag)
    .innerJoin(tag, eq(tag.id, mealTag.tagId))
    .where(inArray(mealTag.mealId, mealIds));

  for (const row of rows) {
    const existing = map.get(row.mealId);
    if (existing) existing.push(row.name);
    else map.set(row.mealId, [row.name]);
  }
  return map;
}

/**
 * A plan's tags are the deduped union of its meals' tags — plans carry no
 * tags of their own. Keyed by plan id, mirroring {@link tagsByMealIds}.
 */
export async function tagsForPlansViaMeals(planIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (planIds.length === 0) return map;

  await requireUser();
  const db = await getDb();
  const rows = await db
    .selectDistinct({ planId: planItem.planId, name: tag.name })
    .from(planItem)
    .innerJoin(mealTag, eq(mealTag.mealId, planItem.mealId))
    .innerJoin(tag, eq(tag.id, mealTag.tagId))
    .where(inArray(planItem.planId, planIds));

  for (const row of rows) {
    const existing = map.get(row.planId);
    if (existing) existing.push(row.name);
    else map.set(row.planId, [row.name]);
  }
  for (const [id, names] of map) map.set(id, names.sort((a, b) => a.localeCompare(b)));
  return map;
}

/**
 * Tags ordered by how recently they were attached to a meal — the chip row
 * on the Meals and Plans pages. Only tags actually used on a meal ever show
 * here, so an empty result never dead-ends the filter.
 */
export async function recentMealTags(limit = 10): Promise<TagOption[]> {
  await requireUser();
  const db = await getDb();
  return db
    .select({ id: tag.id, name: tag.name })
    .from(mealTag)
    .innerJoin(tag, eq(tag.id, mealTag.tagId))
    .groupBy(tag.id)
    .orderBy(desc(sql`max(${mealTag.createdAt})`))
    .limit(limit);
}

/** Every tag used on at least one meal, alphabetical — the "Show more" list. */
export async function allMealTagsUsed(): Promise<TagOption[]> {
  await requireUser();
  const db = await getDb();
  return db
    .select({ id: tag.id, name: tag.name })
    .from(mealTag)
    .innerJoin(tag, eq(tag.id, mealTag.tagId))
    .groupBy(tag.id)
    .orderBy(asc(tag.name));
}

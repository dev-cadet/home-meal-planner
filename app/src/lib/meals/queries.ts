import "server-only";

import { and, asc, count, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { cache } from "react";

import { requireUser } from "../auth/dal";
import { getDb } from "../db/client";
import {
  meal,
  mealImage,
  mealIngredient,
  mealPin,
  mealStep,
  mealTag,
  planItem,
  scheduleEntry,
  tag,
  user,
} from "../db/schema";
import { tagsByMealIds } from "../tags/queries";

/**
 * Reads for the Meals feature.
 *
 * Every function calls `requireUser()` first — authorisation lives next to the
 * data, not in the proxy (docs/plan.md §2). There is no per-row ownership:
 * content is shared, so the only question is whether the caller is signed in.
 */

export interface MealListItem {
  id: string;
  name: string;
  servings: number | null;
  prepMins: number | null;
  cookMins: number | null;
  imageHash: string | null;
  ingredientCount: number;
  tags: string[];
  pinned: boolean;
}

export async function listMeals(
  search?: string,
  tags?: string[],
): Promise<MealListItem[]> {
  const viewer = await requireUser();
  const db = await getDb();

  const term = search?.trim();
  // SQLite LIKE is case-insensitive for ASCII by default.
  const matchingStepMealIds = term
    ? db
        .select({ id: mealStep.mealId })
        .from(mealStep)
        .where(like(mealStep.text, `%${term}%`))
    : undefined;
  const textFilter = term
    ? or(like(meal.name, `%${term}%`), inArray(meal.id, matchingStepMealIds!))
    : undefined;

  // A meal must carry every requested tag, not just one — selecting more
  // chips narrows the list rather than widening it.
  const activeTags = (tags ?? []).filter((t) => t.trim() !== "");
  const matchingIds =
    activeTags.length > 0
      ? db
          .select({ id: mealTag.mealId })
          .from(mealTag)
          .innerJoin(tag, eq(tag.id, mealTag.tagId))
          .where(inArray(tag.name, activeTags))
          .groupBy(mealTag.mealId)
          .having(sql`count(distinct ${tag.name}) = ${activeTags.length}`)
      : undefined;

  const rows = await db
    .select({
      id: meal.id,
      name: meal.name,
      servings: meal.servings,
      prepMins: meal.prepMins,
      cookMins: meal.cookMins,
      imageHash: meal.imageHash,
      ingredientCount: count(mealIngredient.id),
      pinnedByViewer: mealPin.userId,
    })
    .from(meal)
    .leftJoin(mealIngredient, eq(mealIngredient.mealId, meal.id))
    .leftJoin(mealPin, and(eq(mealPin.mealId, meal.id), eq(mealPin.userId, viewer.id)))
    .where(and(textFilter, matchingIds ? inArray(meal.id, matchingIds) : undefined))
    .groupBy(meal.id)
    .orderBy(desc(mealPin.userId), asc(meal.name));

  const tagsById = await tagsByMealIds(rows.map((r) => r.id));
  return rows.map(({ pinnedByViewer, ...r }) => ({
    ...r,
    pinned: pinnedByViewer != null,
    tags: tagsById.get(r.id) ?? [],
  }));
}

/**
 * Memoised per request, because both `generateMetadata` and the page body
 * need it and neither should pay for the other's lookup.
 */
export const getMeal = cache(async (id: string) => {
  const viewer = await requireUser();
  const db = await getDb();

  const [row] = await db
    .select({
      meal,
      createdBy: user.name,
    })
    .from(meal)
    .leftJoin(user, eq(user.id, meal.createdById))
    .where(eq(meal.id, id));

  if (!row) return null;

  const ingredients = await db
    .select()
    .from(mealIngredient)
    .where(eq(mealIngredient.mealId, id))
    .orderBy(asc(mealIngredient.position));

  const steps = await db
    .select()
    .from(mealStep)
    .where(eq(mealStep.mealId, id))
    .orderBy(asc(mealStep.position));

  const [pin] = await db
    .select({ userId: mealPin.userId })
    .from(mealPin)
    .where(and(eq(mealPin.mealId, id), eq(mealPin.userId, viewer.id)));

  return { ...row.meal, createdByName: row.createdBy, ingredients, steps, pinned: !!pin };
});

/**
 * Where else a meal is used. Deleting cascades to these rows, so the user is
 * told what will disappear before it does.
 */
export async function mealReferences(id: string) {
  await requireUser();
  const db = await getDb();

  const [plans] = await db
    .select({ n: count() })
    .from(planItem)
    .where(eq(planItem.mealId, id));
  const [scheduled] = await db
    .select({ n: count() })
    .from(scheduleEntry)
    .where(eq(scheduleEntry.mealId, id));

  return { plans: plans?.n ?? 0, scheduled: scheduled?.n ?? 0 };
}

/** Image bytes for the serving route. Returns null when the meal has none. */
export async function getMealImage(id: string, size: "full" | "thumb") {
  await requireUser();
  const db = await getDb();

  const [row] = await db
    .select({
      bytes: size === "thumb" ? mealImage.thumb : mealImage.full,
      mime: mealImage.mime,
      hash: mealImage.hash,
    })
    .from(mealImage)
    .where(eq(mealImage.mealId, id));

  return row ?? null;
}

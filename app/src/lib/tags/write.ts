import { eq, inArray } from "drizzle-orm";

import type { Database } from "../db/client";
import { mealTag, tag } from "../db/schema";
import { normalizeTagNames } from "./normalize";

/**
 * Find-or-create meal tags by name, matching case-insensitively so "Vegan"
 * and "vegan" resolve to the same row. The tag table stays small for a
 * household app, so one full read is cheap and simpler than an expression
 * index.
 */
async function resolveMealTagIds(db: Database, rawNames: string[]): Promise<string[]> {
  const names = normalizeTagNames(rawNames);
  if (names.length === 0) return [];

  const existing = await db.select().from(tag);
  const byLower = new Map(existing.map((row) => [row.name.toLowerCase(), row.id]));

  const toCreate = names.filter((name) => !byLower.has(name.toLowerCase()));
  if (toCreate.length > 0) {
    const created = await db
      .insert(tag)
      .values(toCreate.map((name) => ({ name })))
      .onConflictDoNothing()
      .returning();
    for (const row of created) byLower.set(row.name.toLowerCase(), row.id);
  }

  return names
    .map((name) => byLower.get(name.toLowerCase()))
    .filter((id): id is string => id != null);
}

/**
 * Delete any of the given meal tags that no longer appear on any meal. A tag
 * that fell out of use — removed from a meal, or its last meal deleted —
 * should stop existing, not linger forever as dead vocabulary that keeps
 * showing up as a suggestion.
 */
export async function pruneOrphanedMealTags(db: Database, candidateIds: string[]): Promise<void> {
  if (candidateIds.length === 0) return;

  const stillUsed = await db
    .select({ tagId: mealTag.tagId })
    .from(mealTag)
    .where(inArray(mealTag.tagId, candidateIds));
  const usedIds = new Set(stillUsed.map((r) => r.tagId));
  const orphaned = candidateIds.filter((id) => !usedIds.has(id));

  if (orphaned.length > 0) {
    await db.delete(tag).where(inArray(tag.id, orphaned));
  }
}

/** Replace a meal's tag associations wholesale — mirrors writeIngredients. */
export async function writeMealTags(
  db: Database,
  mealId: string,
  names: string[],
): Promise<void> {
  const tagIds = await resolveMealTagIds(db, names);

  const previous = await db
    .select({ tagId: mealTag.tagId })
    .from(mealTag)
    .where(eq(mealTag.mealId, mealId));

  await db.delete(mealTag).where(eq(mealTag.mealId, mealId));
  if (tagIds.length > 0) {
    await db.insert(mealTag).values(tagIds.map((tagId) => ({ mealId, tagId })));
  }

  await pruneOrphanedMealTags(db, previous.map((r) => r.tagId));
}

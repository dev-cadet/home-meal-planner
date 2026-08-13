import { and, asc, desc, eq, inArray, max } from "drizzle-orm";

import type { Database } from "../db/client";
import { shoppingList, shoppingListItem } from "../db/schema";
import type { ShoppingItem } from "../shopping/aggregate";
import type { Measure } from "../units";

/**
 * The DB-touching core for saved shopping lists — the one genuinely
 * personal, per-user corner of this app (docs/plan.md's "everything is
 * shared" rule doesn't apply here).
 *
 * Every function here takes `db` and `userId` explicitly rather than calling
 * `requireUser()` itself, mirroring `lib/tags/write.ts`: it keeps the
 * ownership-filtering logic — the security-critical part — directly
 * testable without mocking a session. `queries.ts` (server-only) and
 * `actions.ts` ("use server") are the real, session-checked entry points
 * every page and form actually calls; they're thin wrappers around these.
 */

export interface SavedShoppingListSummary {
  id: string;
  name: string;
  pinned: boolean;
  itemCount: number;
  checkedCount: number;
  createdAt: Date;
}

export interface SavedShoppingListItem {
  id: string;
  name: string;
  measures: Measure[];
  checked: boolean;
}

export interface SavedShoppingListDetail {
  id: string;
  name: string;
  pinned: boolean;
  createdAt: Date;
  items: SavedShoppingListItem[];
}

function parseMeasures(json: string): Measure[] {
  return JSON.parse(json) as Measure[];
}

export async function listShoppingListsForUser(
  db: Database,
  userId: string,
): Promise<SavedShoppingListSummary[]> {
  const lists = await db
    .select()
    .from(shoppingList)
    .where(eq(shoppingList.userId, userId))
    .orderBy(desc(shoppingList.pinned), desc(shoppingList.createdAt));

  if (lists.length === 0) return [];

  const items = await db
    .select({
      shoppingListId: shoppingListItem.shoppingListId,
      checked: shoppingListItem.checked,
    })
    .from(shoppingListItem)
    .where(
      inArray(
        shoppingListItem.shoppingListId,
        lists.map((l) => l.id),
      ),
    );

  const counts = new Map<string, { itemCount: number; checkedCount: number }>();
  for (const item of items) {
    const entry = counts.get(item.shoppingListId) ?? { itemCount: 0, checkedCount: 0 };
    entry.itemCount += 1;
    if (item.checked) entry.checkedCount += 1;
    counts.set(item.shoppingListId, entry);
  }

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    pinned: list.pinned,
    createdAt: list.createdAt,
    itemCount: counts.get(list.id)?.itemCount ?? 0,
    checkedCount: counts.get(list.id)?.checkedCount ?? 0,
  }));
}

/**
 * A single saved list, only if it belongs to `userId`. A list that exists
 * but belongs to someone else returns `null` — identical to a list that
 * doesn't exist at all, so there is no observable difference between "not
 * yours" and "doesn't exist" for a caller to probe.
 */
export async function getShoppingListForUser(
  db: Database,
  userId: string,
  id: string,
): Promise<SavedShoppingListDetail | null> {
  const [list] = await db
    .select()
    .from(shoppingList)
    .where(and(eq(shoppingList.id, id), eq(shoppingList.userId, userId)));
  if (!list) return null;

  const items = await db
    .select()
    .from(shoppingListItem)
    .where(eq(shoppingListItem.shoppingListId, id))
    .orderBy(asc(shoppingListItem.position));

  return {
    id: list.id,
    name: list.name,
    pinned: list.pinned,
    createdAt: list.createdAt,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      measures: parseMeasures(item.measuresJson),
      checked: item.checked,
    })),
  };
}

/** Saves a fresh snapshot: a new list row plus one row per item, in order. */
export async function createShoppingListForUser(
  db: Database,
  userId: string,
  name: string,
  items: ShoppingItem[],
): Promise<string> {
  const [row] = await db
    .insert(shoppingList)
    .values({ userId, name })
    .returning({ id: shoppingList.id });

  if (items.length > 0) {
    await db.insert(shoppingListItem).values(
      items.map((item, position) => ({
        shoppingListId: row!.id,
        position,
        name: item.name,
        measuresJson: JSON.stringify(item.measures),
      })),
    );
  }

  return row!.id;
}

/**
 * Toggles one item's checked state. A list id belonging to someone else
 * matches zero rows here, so this silently touches nothing rather than
 * needing a separate authorization branch.
 */
export async function toggleShoppingListItemForUser(
  db: Database,
  userId: string,
  listId: string,
  itemId: string,
  checked: boolean,
): Promise<void> {
  const [owned] = await db
    .select({ id: shoppingList.id })
    .from(shoppingList)
    .where(and(eq(shoppingList.id, listId), eq(shoppingList.userId, userId)));
  if (!owned) return;

  await db
    .update(shoppingListItem)
    .set({ checked })
    .where(and(eq(shoppingListItem.id, itemId), eq(shoppingListItem.shoppingListId, listId)));
}

export async function deleteShoppingListForUser(
  db: Database,
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(shoppingList)
    .where(and(eq(shoppingList.id, id), eq(shoppingList.userId, userId)));
}

/** Ownership-filtered rename — a list id belonging to someone else matches zero rows. */
export async function renameShoppingListForUser(
  db: Database,
  userId: string,
  id: string,
  name: string,
): Promise<void> {
  await db
    .update(shoppingList)
    .set({ name })
    .where(and(eq(shoppingList.id, id), eq(shoppingList.userId, userId)));
}

/**
 * Whether the caller already has a saved list with this exact name. Used to
 * warn before an accidental duplicate save; renaming a list deliberately
 * breaks the match, so saving the same plan/range again after a rename is
 * treated as a fresh, unique list rather than a duplicate.
 */
export async function hasShoppingListNamedForUser(
  db: Database,
  userId: string,
  name: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: shoppingList.id })
    .from(shoppingList)
    .where(and(eq(shoppingList.userId, userId), eq(shoppingList.name, name)))
    .limit(1);
  return !!row;
}

/** Appends a name-only item at the end of an owned list. Silently no-ops otherwise. */
export async function addShoppingListItemForUser(
  db: Database,
  userId: string,
  listId: string,
  name: string,
): Promise<void> {
  const [owned] = await db
    .select({ id: shoppingList.id })
    .from(shoppingList)
    .where(and(eq(shoppingList.id, listId), eq(shoppingList.userId, userId)));
  if (!owned) return;

  const [row] = await db
    .select({ highest: max(shoppingListItem.position) })
    .from(shoppingListItem)
    .where(eq(shoppingListItem.shoppingListId, listId));

  await db.insert(shoppingListItem).values({
    shoppingListId: listId,
    position: (row?.highest ?? -1) + 1,
    name,
    measuresJson: "[]",
  });
}

/** Removes one item from an owned list. Silently no-ops otherwise. */
export async function removeShoppingListItemForUser(
  db: Database,
  userId: string,
  listId: string,
  itemId: string,
): Promise<void> {
  const [owned] = await db
    .select({ id: shoppingList.id })
    .from(shoppingList)
    .where(and(eq(shoppingList.id, listId), eq(shoppingList.userId, userId)));
  if (!owned) return;

  await db
    .delete(shoppingListItem)
    .where(and(eq(shoppingListItem.id, itemId), eq(shoppingListItem.shoppingListId, listId)));
}

/** Ownership-filtered pin/unpin — a list id belonging to someone else matches zero rows. */
export async function togglePinShoppingListForUser(
  db: Database,
  userId: string,
  id: string,
  pinned: boolean,
): Promise<void> {
  await db
    .update(shoppingList)
    .set({ pinned })
    .where(and(eq(shoppingList.id, id), eq(shoppingList.userId, userId)));
}

/** Unchecks every item on an owned list, in one shot. Silently no-ops otherwise. */
export async function resetShoppingListCheckedForUser(
  db: Database,
  userId: string,
  listId: string,
): Promise<void> {
  const [owned] = await db
    .select({ id: shoppingList.id })
    .from(shoppingList)
    .where(and(eq(shoppingList.id, listId), eq(shoppingList.userId, userId)));
  if (!owned) return;

  await db
    .update(shoppingListItem)
    .set({ checked: false })
    .where(eq(shoppingListItem.shoppingListId, listId));
}

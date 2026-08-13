import "server-only";

import { requireUser } from "../auth/dal";
import { getDb } from "../db/client";
import {
  getShoppingListForUser,
  hasShoppingListNamedForUser,
  listShoppingListsForUser,
} from "./records";

export type {
  SavedShoppingListDetail,
  SavedShoppingListItem,
  SavedShoppingListSummary,
} from "./records";

/** The current user's saved shopping lists, newest first — never another user's. */
export async function listShoppingLists() {
  const user = await requireUser();
  const db = await getDb();
  return listShoppingListsForUser(db, user.id);
}

/** A single saved list, only if it belongs to the current user (see {@link getShoppingListForUser}). */
export async function getShoppingList(id: string) {
  const user = await requireUser();
  const db = await getDb();
  return getShoppingListForUser(db, user.id, id);
}

/** Whether the current user already has a saved list with this exact name. */
export async function hasShoppingListNamed(name: string) {
  const user = await requireUser();
  const db = await getDb();
  return hasShoppingListNamedForUser(db, user.id, name);
}

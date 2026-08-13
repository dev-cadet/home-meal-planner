"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "../auth/dal";
import { config } from "../config";
import { isIsoDate } from "../date";
import { getDb } from "../db/client";
import { getPlan } from "../plans/queries";
import { defaultShoppingListNameForPlan, defaultShoppingListNameForRange } from "./naming";
import {
  addShoppingListItemForUser,
  createShoppingListForUser,
  deleteShoppingListForUser,
  removeShoppingListItemForUser,
  renameShoppingListForUser,
  resetShoppingListCheckedForUser,
  toggleShoppingListItemForUser,
  togglePinShoppingListForUser,
} from "./records";
import { aggregate } from "../shopping/aggregate";
import { ingredientsForPlan, ingredientsForRange } from "../shopping/queries";

export interface ShoppingListFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const blankListSchema = z.object({
  name: z.string().trim().min(1, "Give the list a name.").max(160),
});

/** Saves a fresh snapshot of a plan's shopping list. Recomputes server-side rather than trusting anything from the client. */
export async function saveShoppingListFromPlanAction(planId: string): Promise<void> {
  const user = await requireUser();
  const plan = await getPlan(planId);
  if (!plan) return;

  const source = await ingredientsForPlan(planId);
  const items = aggregate(source.lines, config.MEASUREMENT_SYSTEM);

  const db = await getDb();
  const id = await createShoppingListForUser(
    db,
    user.id,
    defaultShoppingListNameForPlan(plan.name),
    items,
  );

  revalidatePath("/shopping-lists");
  redirect(`/shopping-lists/${id}`);
}

/** Saves a fresh snapshot of a schedule date range's shopping list. */
export async function saveShoppingListFromRangeAction(from: string, to: string): Promise<void> {
  const user = await requireUser();
  if (!isIsoDate(from) || !isIsoDate(to)) return;

  const source = await ingredientsForRange(from, to);
  const items = aggregate(source.lines, config.MEASUREMENT_SYSTEM);

  const db = await getDb();
  const id = await createShoppingListForUser(
    db,
    user.id,
    defaultShoppingListNameForRange(from, to),
    items,
  );

  revalidatePath("/shopping-lists");
  redirect(`/shopping-lists/${id}`);
}

/** Toggles one item's checked state and persists immediately — no separate save step. */
export async function toggleShoppingListItemAction(
  listId: string,
  itemId: string,
  checked: boolean,
): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  await toggleShoppingListItemForUser(db, user.id, listId, itemId, checked);

  revalidatePath(`/shopping-lists/${listId}`);
}

export async function deleteShoppingListAction(id: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  await deleteShoppingListForUser(db, user.id, id);

  revalidatePath("/shopping-lists");
  redirect("/shopping-lists");
}

/** Renames a saved list. A blank name is a no-op rather than an error — this is a low-stakes edit. */
export async function renameShoppingListAction(id: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const db = await getDb();
  await renameShoppingListForUser(db, user.id, id, name.slice(0, 160));

  revalidatePath("/shopping-lists");
  revalidatePath(`/shopping-lists/${id}`);
}

/** Appends a name-only item ("forgot the milk") to a saved list. */
export async function addShoppingListItemAction(
  listId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const db = await getDb();
  await addShoppingListItemForUser(db, user.id, listId, name.slice(0, 200));

  revalidatePath(`/shopping-lists/${listId}`);
}

/** Removes one item from a saved list and persists immediately, like toggling. */
export async function removeShoppingListItemAction(
  listId: string,
  itemId: string,
): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  await removeShoppingListItemForUser(db, user.id, listId, itemId);

  revalidatePath(`/shopping-lists/${listId}`);
}

/** Creates a blank list — no plan or range behind it, just a name. */
export async function createBlankShoppingListAction(
  _prev: ShoppingListFormState,
  formData: FormData,
): Promise<ShoppingListFormState> {
  const user = await requireUser();
  const parsed = blankListSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const db = await getDb();
  const id = await createShoppingListForUser(db, user.id, parsed.data.name, []);

  revalidatePath("/shopping-lists");
  redirect(`/shopping-lists/${id}`);
}

/** Pins or unpins a list — pinned lists sort to the top of the index. */
export async function togglePinShoppingListAction(id: string, pinned: boolean): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  await togglePinShoppingListForUser(db, user.id, id, pinned);

  revalidatePath("/shopping-lists");
  revalidatePath(`/shopping-lists/${id}`);
}

/** Unchecks every item on a list in one go, so it can be reused without recreating it. */
export async function resetShoppingListCheckedAction(listId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  await resetShoppingListCheckedForUser(db, user.id, listId);

  revalidatePath(`/shopping-lists/${listId}`);
}

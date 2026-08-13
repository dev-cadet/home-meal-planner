"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "../auth/dal";
import { getDb } from "../db/client";
import { plan, planItem } from "../db/schema";
import { setPlanPinned } from "../pins/write";
import { currentOrder, moveInOrder, setPlanOrder } from "./ordering";

export interface PlanFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const planSchema = z.object({
  name: z.string().trim().min(1, "Give the plan a name.").max(160),
  description: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().max(1000).optional(),
  ),
});

function parse(formData: FormData) {
  return planSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
}

/* ------------------------------------------------------------------ *
 * Plan CRUD
 * ------------------------------------------------------------------ */

export async function createPlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const db = await getDb();
  const [row] = await db
    .insert(plan)
    .values({ ...parsed.data, createdById: user.id, updatedById: user.id })
    .returning({ id: plan.id });

  revalidatePath("/plans");
  redirect(`/plans/${row!.id}`);
}

export async function updatePlanAction(
  planId: string,
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const db = await getDb();
  await db
    .update(plan)
    .set({ ...parsed.data, updatedById: user.id })
    .where(eq(plan.id, planId));

  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  redirect(`/plans/${planId}`);
}

export async function deletePlanAction(planId: string): Promise<void> {
  await requireUser();
  const db = await getDb();

  // plan_item and pin associations cascade; the meals themselves are untouched.
  await db.delete(plan).where(eq(plan.id, planId));

  revalidatePath("/plans");
  redirect("/plans");
}

/** Pins or unpins a plan for the current user only — shared content, per-user opinion. */
export async function togglePinPlanAction(planId: string, pinned: boolean): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  await setPlanPinned(db, user.id, planId, pinned);

  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
}

/* ------------------------------------------------------------------ *
 * Plan contents
 * ------------------------------------------------------------------ */

export async function addMealsToPlanAction(
  planId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const mealIds = formData
    .getAll("mealId")
    .filter((v): v is string => typeof v === "string");

  if (mealIds.length === 0) return;

  const db = await getDb();
  const [row] = await db
    .select({ highest: max(planItem.position) })
    .from(planItem)
    .where(eq(planItem.planId, planId));

  let position = (row?.highest ?? -1) + 1;

  await db
    .insert(planItem)
    .values(mealIds.map((mealId) => ({ planId, mealId, position: position++ })))
    // UNIQUE(plan_id, meal_id): adding a meal twice is a no-op, not an error.
    .onConflictDoNothing();

  await db.update(plan).set({ updatedById: user.id }).where(eq(plan.id, planId));

  revalidatePath(`/plans/${planId}`);
  redirect(`/plans/${planId}`);
}

export async function removeMealFromPlanAction(
  planId: string,
  mealId: string,
): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  await db
    .delete(planItem)
    .where(and(eq(planItem.planId, planId), eq(planItem.mealId, mealId)));

  // Close the gap so positions stay contiguous.
  await setPlanOrder(db, planId, await currentOrder(db, planId));
  await db.update(plan).set({ updatedById: user.id }).where(eq(plan.id, planId));

  revalidatePath(`/plans/${planId}`);
}

export async function moveMealInPlanAction(
  planId: string,
  mealId: string,
  direction: "up" | "down",
): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  const reordered = moveInOrder(await currentOrder(db, planId), mealId, direction);
  await setPlanOrder(db, planId, reordered);
  await db.update(plan).set({ updatedById: user.id }).where(eq(plan.id, planId));

  revalidatePath(`/plans/${planId}`);
}

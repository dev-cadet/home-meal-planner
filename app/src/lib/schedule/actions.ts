"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "../auth/dal";
import { isIsoDate } from "../date";
import { getDb } from "../db/client";
import { scheduleEntry, MEAL_SLOTS } from "../db/schema";

/**
 * The date is validated as a plain calendar date here as well as by the
 * `GLOB` CHECK on the column. Two layers, because an instant leaking into a
 * date column is the failure mode the whole design guards against.
 */
const entrySchema = z.object({
  date: z.string().refine(isIsoDate, "Pick a valid date."),
  slot: z.enum(MEAL_SLOTS),
});

export async function assignMealsAction(
  date: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();

  // The slot is chosen in the same sheet as the meals, so it arrives with them.
  const parsed = entrySchema.safeParse({ date, slot: formData.get("slot") });
  if (!parsed.success) return;

  const mealIds = formData
    .getAll("mealId")
    .filter((v): v is string => typeof v === "string");
  if (mealIds.length === 0) return;

  const db = await getDb();
  await db
    .insert(scheduleEntry)
    .values(
      mealIds.map((mealId) => ({
        date: parsed.data.date,
        slot: parsed.data.slot,
        mealId,
        createdById: user.id,
        updatedById: user.id,
      })),
    )
    // UNIQUE(date, slot, meal_id): several meals may share a slot, but the
    // same meal twice in one slot is a no-op rather than an error.
    .onConflictDoNothing();

  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function moveEntryAction(
  entryId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();

  const parsed = entrySchema.safeParse({
    date: formData.get("date"),
    slot: formData.get("slot"),
  });
  if (!parsed.success) return;

  const db = await getDb();
  await db
    .update(scheduleEntry)
    .set({ ...parsed.data, updatedById: user.id })
    .where(eq(scheduleEntry.id, entryId));

  revalidatePath("/schedule");
  revalidatePath("/");
}

/** Nudge an entry a whole day earlier or later, keeping its slot. */
export async function shiftEntryAction(
  entryId: string,
  newDate: string,
): Promise<void> {
  const user = await requireUser();
  if (!isIsoDate(newDate)) return;

  const db = await getDb();
  await db
    .update(scheduleEntry)
    .set({ date: newDate, updatedById: user.id })
    .where(eq(scheduleEntry.id, entryId));

  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function removeEntryAction(entryId: string): Promise<void> {
  await requireUser();
  const db = await getDb();

  await db.delete(scheduleEntry).where(eq(scheduleEntry.id, entryId));

  revalidatePath("/schedule");
  revalidatePath("/");
}

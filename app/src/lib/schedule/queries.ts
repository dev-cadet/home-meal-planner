import "server-only";

import { and, asc, count, eq, gte, lte } from "drizzle-orm";

import { requireUser } from "../auth/dal";
import { getDb } from "../db/client";
import { meal, scheduleEntry, MEAL_SLOTS, type MealSlot } from "../db/schema";
import { tagsByMealIds } from "../tags/queries";
import type { IsoDate } from "../date";

export interface ScheduledMeal {
  entryId: string;
  date: IsoDate;
  slot: MealSlot;
  mealId: string;
  name: string;
  servings: number | null;
  prepMins: number | null;
  cookMins: number | null;
  imageHash: string | null;
}

/**
 * Entries between two calendar dates, inclusive.
 *
 * Dates are plain `YYYY-MM-DD` text, so the range comparison is a plain string
 * comparison — lexicographic order matches chronological order for this format,
 * and no timezone enters the query.
 */
export async function scheduleBetween(
  from: IsoDate,
  to: IsoDate,
): Promise<ScheduledMeal[]> {
  await requireUser();
  const db = await getDb();

  const rows = await db
    .select({
      entryId: scheduleEntry.id,
      date: scheduleEntry.date,
      slot: scheduleEntry.slot,
      mealId: meal.id,
      name: meal.name,
      servings: meal.servings,
      prepMins: meal.prepMins,
      cookMins: meal.cookMins,
      imageHash: meal.imageHash,
    })
    .from(scheduleEntry)
    .innerJoin(meal, eq(meal.id, scheduleEntry.mealId))
    .where(and(gte(scheduleEntry.date, from), lte(scheduleEntry.date, to)))
    .orderBy(asc(scheduleEntry.date), asc(meal.name));

  return rows as ScheduledMeal[];
}

/** How many meals sit on each date in a range — enough for the month grid. */
export async function scheduleCounts(
  from: IsoDate,
  to: IsoDate,
): Promise<Map<IsoDate, number>> {
  await requireUser();
  const db = await getDb();

  const rows = await db
    .select({ date: scheduleEntry.date, n: count() })
    .from(scheduleEntry)
    .where(and(gte(scheduleEntry.date, from), lte(scheduleEntry.date, to)))
    .groupBy(scheduleEntry.date);

  return new Map(rows.map((r) => [r.date, r.n]));
}

export type DaySchedule = Record<MealSlot, ScheduledMeal[]>;

const emptyDay = (): DaySchedule => ({
  breakfast: [],
  lunch: [],
  dinner: [],
  snack: [],
});

/** Index a flat list by date, then by slot, so views can read it directly. */
export function groupByDay(
  entries: ScheduledMeal[],
): Map<IsoDate, DaySchedule> {
  const byDay = new Map<IsoDate, DaySchedule>();

  for (const entry of entries) {
    let day = byDay.get(entry.date);
    if (!day) {
      day = emptyDay();
      byDay.set(entry.date, day);
    }
    day[entry.slot].push(entry);
  }

  return byDay;
}

export function dayScheduleFor(
  byDay: Map<IsoDate, DaySchedule>,
  date: IsoDate,
): DaySchedule {
  return byDay.get(date) ?? emptyDay();
}

export const SLOTS = MEAL_SLOTS;

export const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** Meals available to schedule, for the picker. */
export async function schedulableMeals() {
  await requireUser();
  const db = await getDb();

  const meals = await db
    .select({
      id: meal.id,
      name: meal.name,
      imageHash: meal.imageHash,
      servings: meal.servings,
    })
    .from(meal)
    .orderBy(asc(meal.name));

  const tagsById = await tagsByMealIds(meals.map((m) => m.id));
  return meals.map((m) => ({ ...m, tags: tagsById.get(m.id) ?? [] }));
}

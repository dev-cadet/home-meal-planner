import "server-only";

import { desc } from "drizzle-orm";

import { requireUser } from "../auth/dal";
import { addDays, eachDay, todayInAppTimeZone, type IsoDate } from "../date";
import { getDb } from "../db/client";
import { meal } from "../db/schema";
import { groupByDay, scheduleBetween } from "../schedule/queries";

/** How many days *beyond today* the "coming up" strip covers. */
const LOOKAHEAD = 4;

export async function homeData() {
  await requireUser();
  const db = await getDb();

  const today: IsoDate = todayInAppTimeZone();
  const horizon = addDays(today, LOOKAHEAD);

  const byDay = groupByDay(await scheduleBetween(today, horizon));

  const recent = await db
    .select({
      id: meal.id,
      name: meal.name,
      imageHash: meal.imageHash,
      servings: meal.servings,
      prepMins: meal.prepMins,
      cookMins: meal.cookMins,
    })
    .from(meal)
    .orderBy(desc(meal.createdAt))
    .limit(6);

  return {
    today,
    /**
     * Today first, then the lookahead. Today is part of the list rather than a
     * separate card: with the headline card gone, this is the only thing on the
     * page that answers "what are we eating tonight".
     */
    days: eachDay(today, horizon).map((date) => ({
      date,
      day: byDay.get(date) ?? null,
    })),
    recent,
  };
}

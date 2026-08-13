import Link from "next/link";

import { MealImage } from "@/components/meals/meal-image";
import { SlotIcon } from "@/components/schedule/slot-icon";
import { cn } from "@/lib/cn";
import { requireUser } from "@/lib/auth/dal";
import { describeDate, formatDate } from "@/lib/date";
import { homeData } from "@/lib/home/queries";
import {
  SLOTS,
  type DaySchedule,
  type ScheduledMeal,
} from "@/lib/schedule/queries";

/**
 * Every meal that day, in menu order.
 *
 * `SLOTS` runs breakfast → snack, so the day reads the way it is eaten rather
 * than the order rows happened to be inserted.
 */
function mealsOf(day: DaySchedule | null): ScheduledMeal[] {
  if (!day) return [];
  return SLOTS.flatMap((slot) => day[slot]);
}

export default async function HomePage() {
  const user = await requireUser();
  const { today, days, recent } = await homeData();

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          Hello, {user.name.split(" ")[0]}
        </h2>
        <p className="text-ink-muted">
          {describeDate(today).weekdayLong}, {formatDate(today)}
        </p>
      </header>

      {/* Coming up ----------------------------------------------------- */}
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium text-ink-muted">Coming up</h3>
          <Link
            href="/schedule"
            className="text-sm font-medium text-primary hover:underline"
          >
            Full schedule
          </Link>
        </div>

        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {days.map(({ date, day }) => {
            const meals = mealsOf(day);
            const parts = describeDate(date);
            const isToday = date === today;

            return (
              <li key={date} className="flex gap-3 px-4 py-3">
                {/* pt-px nudges the smaller date text onto the first meal's
                    baseline; the two run at different sizes. */}
                <span
                  className={cn(
                    "w-16 shrink-0 pt-px text-sm font-medium",
                    isToday ? "text-primary" : "text-ink-muted",
                  )}
                >
                  {isToday ? "Today" : `${parts.weekday} ${parts.day}`}
                </span>

                {meals.length > 0 ? (
                  <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {meals.map((entry) => (
                      <li key={entry.entryId}>
                        <Link
                          href={`/meals/${entry.mealId}`}
                          className="group/meal flex items-center gap-2 text-ink hover:text-primary"
                        >
                          <SlotIcon
                            slot={entry.slot}
                            className="text-ink-faint group-hover/meal:text-primary"
                          />
                          <span className="min-w-0 truncate">{entry.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Link
                    href={`/schedule?view=day&date=${date}`}
                    className="min-w-0 flex-1 text-sm text-ink-faint hover:text-ink"
                  >
                    Nothing planned
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Recently added ------------------------------------------------ */}
      {recent.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-medium text-ink-muted">Recently added</h3>
            <Link
              href="/meals"
              className="text-sm font-medium text-primary hover:underline"
            >
              All meals
            </Link>
          </div>

          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
            {recent.map((m) => (
              <li key={m.id} className="w-32 shrink-0">
                <Link href={`/meals/${m.id}`} className="group block">
                  <MealImage
                    mealId={m.id}
                    imageHash={m.imageHash}
                    name={m.name}
                    size="thumb"
                    className="aspect-square w-full rounded-xl border border-line"
                  />
                  <p className="mt-1.5 line-clamp-2 text-sm text-ink group-hover:text-primary">
                    {m.name}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

import { ShoppingBasket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DayCard } from "@/components/schedule/day-card";
import { MonthView } from "@/components/schedule/month-view";
import {
  ScheduleNav,
  ViewSwitcher,
  type ScheduleView,
} from "@/components/schedule/schedule-nav";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/states";
import { config } from "@/lib/config";
import {
  addDays,
  addMonths,
  describeDate,
  eachDay,
  endOfWeek,
  isIsoDate,
  monthGrid,
  monthLabel,
  startOfMonth,
  startOfWeek,
  todayInAppTimeZone,
  type IsoDate,
} from "@/lib/date";
import {
  dayScheduleFor,
  groupByDay,
  scheduleBetween,
  scheduleCounts,
  schedulableMeals,
} from "@/lib/schedule/queries";

export const metadata: Metadata = { title: "Schedule · Home Meal Planner" };

function parseView(value: unknown): ScheduleView {
  return value === "day" || value === "month" ? value : "week";
}

export default async function SchedulePage({
  searchParams,
}: PageProps<"/schedule">) {
  const params = await searchParams;

  /**
   * "Today" is resolved in the configured zone, not the container's. A UTC
   * server would otherwise mark the wrong day for several hours each night
   * (docs/plan.md §3).
   */
  const today = todayInAppTimeZone();
  const view = parseView(params.view);

  const requested = typeof params.date === "string" ? params.date : "";
  const anchor: IsoDate = isIsoDate(requested) ? requested : today;

  const weekStartsOn = config.WEEK_STARTS_ON;
  const meals = await schedulableMeals();

  if (view === "month") {
    const grid = monthGrid(anchor, weekStartsOn);
    const counts = await scheduleCounts(grid[0]!, grid.at(-1)!);

    return (
      <>
        <PageHeader
          title="Schedule"
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/schedule/shopping-list">
                <ShoppingBasket className="size-4" />
                Shopping list
              </Link>
            </Button>
          }
        />
        <ViewSwitcher view={view} date={anchor} />
        <ScheduleNav
          view={view}
          title={monthLabel(anchor)}
          previous={startOfMonth(addMonths(anchor, -1))}
          next={startOfMonth(addMonths(anchor, 1))}
          today={today}
        />
        <MonthView
          anchor={anchor}
          counts={counts}
          today={today}
          weekStartsOn={weekStartsOn}
        />
        <p className="mt-3 text-center text-xs text-ink-faint">
          Tap a day to open it.
        </p>
      </>
    );
  }

  const from = view === "day" ? anchor : startOfWeek(anchor, weekStartsOn);
  const to = view === "day" ? anchor : endOfWeek(anchor, weekStartsOn);

  const byDay = groupByDay(await scheduleBetween(from, to));
  const days = eachDay(from, to);

  const title =
    view === "day"
      ? `${describeDate(anchor).weekdayLong} ${describeDate(anchor).day} ${describeDate(anchor).monthLong}`
      : `${describeDate(from).day} ${describeDate(from).month} – ${describeDate(to).day} ${describeDate(to).month}`;

  return (
    <>
      <PageHeader
        title="Schedule"
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/schedule/shopping-list">
              <ShoppingBasket className="size-4" />
              Shopping list
            </Link>
          </Button>
        }
      />
      <ViewSwitcher view={view} date={anchor} />
      <ScheduleNav
        view={view}
        title={title}
        previous={view === "day" ? addDays(anchor, -1) : addDays(from, -7)}
        next={view === "day" ? addDays(anchor, 1) : addDays(from, 7)}
        today={today}
      />

      <div className="flex flex-col gap-3">
        {days.map((date) => (
          <DayCard
            key={date}
            date={date}
            day={dayScheduleFor(byDay, date)}
            meals={meals}
            today={today}
            weekStartsOn={weekStartsOn}
            // A single day has room for every slot; a week does not.
            showAllSlots={view === "day"}
          />
        ))}
      </div>
    </>
  );
}

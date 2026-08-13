import { config } from "./config";
import {
  endOfWeek as endOfWeekPure,
  monthGrid as monthGridPure,
  startOfWeek as startOfWeekPure,
  weekdayLabels as weekdayLabelsPure,
  type IsoDate,
  type WeekStart,
} from "./date-math";

/**
 * Calendar dates and instants are different things (docs/plan.md §3).
 *
 * A calendar date is a label — 'YYYY-MM-DD', no zone, never converted. An
 * instant is a moment, stored UTC and rendered in the configured zone.
 *
 * The pure calendar arithmetic lives in `./date-math`, which is config-free so
 * Client Components can import it. This module is the server-side face: it
 * re-exports the maths, fills in the config defaults (`WEEK_STARTS_ON`,
 * `DATE_FORMAT`), and owns the only two functions through which `TZ` enters
 * the app: `todayInAppTimeZone()` and `formatInstant()`.
 */

export {
  addDays,
  addMonths,
  assertIsoDate,
  daysBetween,
  dayOfWeek,
  describeDate,
  eachDay,
  endOfMonth,
  isIsoDate,
  monthLabel,
  ordinalDayMonth,
  startOfMonth,
  type IsoDate,
  type WeekStart,
} from "./date-math";

/* ------------------------------------------------------------------ *
 * Boundary 1 — resolving "today"
 * ------------------------------------------------------------------ */

/**
 * The current calendar date in the configured zone.
 *
 * Containers run UTC, so without this a household in BST sees yesterday's
 * dinner between midnight and 01:00. Built from `formatToParts` rather than a
 * locale string so the layout can't shift with ICU version or locale data.
 */
export function todayInAppTimeZone(
  now: Date = new Date(),
  timeZone: string = config.TZ,
): IsoDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/* ------------------------------------------------------------------ *
 * Boundary 2 — displaying instants
 * ------------------------------------------------------------------ */

export function formatInstant(
  instant: Date,
  timeZone: string = config.TZ,
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(instant);
}

/* ------------------------------------------------------------------ *
 * Config-defaulted wrappers around the pure maths
 * ------------------------------------------------------------------ */

export function startOfWeek(
  date: IsoDate,
  weekStartsOn: WeekStart = config.WEEK_STARTS_ON,
): IsoDate {
  return startOfWeekPure(date, weekStartsOn);
}

export function endOfWeek(
  date: IsoDate,
  weekStartsOn: WeekStart = config.WEEK_STARTS_ON,
): IsoDate {
  return endOfWeekPure(date, weekStartsOn);
}

export function monthGrid(
  date: IsoDate,
  weekStartsOn: WeekStart = config.WEEK_STARTS_ON,
): IsoDate[] {
  return monthGridPure(date, weekStartsOn);
}

export function weekdayLabels(
  weekStartsOn: WeekStart = config.WEEK_STARTS_ON,
  style: "short" | "narrow" = "short",
): string[] {
  return weekdayLabelsPure(weekStartsOn, style);
}

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

export function formatDate(
  date: IsoDate,
  format: typeof config.DATE_FORMAT = config.DATE_FORMAT,
): string {
  const [y, m, d] = date.split("-") as [string, string, string];
  switch (format) {
    case "DD/MM/YYYY":
      return `${d}/${m}/${y}`;
    case "MM/DD/YYYY":
      return `${m}/${d}/${y}`;
    case "YYYY-MM-DD":
      return date;
  }
}

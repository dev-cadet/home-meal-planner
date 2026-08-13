/**
 * Pure calendar arithmetic on 'YYYY-MM-DD' strings. No timezone, no config.
 *
 * This module exists so Client Components can share the calendar maths:
 * `@/lib/date` pulls in `config`, whose bare `process.env` read has no place
 * in a browser bundle. Server code should import `@/lib/date`, which
 * re-exports everything here plus the config-defaulted and TZ-boundary
 * functions. Anything needing `WEEK_STARTS_ON` takes it as an explicit
 * argument here — the defaults live in `@/lib/date`.
 *
 * UTC below is purely a fixed frame for the maths; because both ends are UTC
 * it cancels out, and DST can never shift a result (docs/plan.md §3).
 */

/** A calendar date: 'YYYY-MM-DD'. */
export type IsoDate = string;

export type WeekStart = "monday" | "sunday";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Rejects 2026-02-30, which would otherwise roll over to March.
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function assertIsoDate(value: string): IsoDate {
  if (!isIsoDate(value)) {
    throw new Error(`Expected a calendar date as YYYY-MM-DD, received "${value}"`);
  }
  return value;
}

const pad = (n: number) => String(n).padStart(2, "0");

function toUtc(date: IsoDate): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(dt: Date): IsoDate {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const dt = toUtc(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtc(dt);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: IsoDate): number {
  return toUtc(date).getUTCDay();
}

export function startOfWeek(date: IsoDate, weekStartsOn: WeekStart): IsoDate {
  const dow = dayOfWeek(date);
  const offset = weekStartsOn === "monday" ? (dow + 6) % 7 : dow;
  return addDays(date, -offset);
}

export function endOfWeek(date: IsoDate, weekStartsOn: WeekStart): IsoDate {
  return addDays(startOfWeek(date, weekStartsOn), 6);
}

/** Inclusive range, ascending. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const span = daysBetween(from, to);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, i) => addDays(from, i));
}

export function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: IsoDate): IsoDate {
  const [y, m] = date.split("-").map(Number) as [number, number, number];
  // Day 0 of the next month is the last day of this one.
  return fromUtc(new Date(Date.UTC(y, m, 0)));
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  // Clamp: 31 Jan + 1 month is 28/29 Feb, not 2/3 March.
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return fromUtc(
    new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay))),
  );
}

/**
 * The dates a month-view grid must render: whole weeks covering the month,
 * including the leading and trailing days from adjacent months.
 */
export function monthGrid(date: IsoDate, weekStartsOn: WeekStart): IsoDate[] {
  const first = startOfWeek(startOfMonth(date), weekStartsOn);
  const last = endOfWeek(endOfMonth(date), weekStartsOn);
  return eachDay(first, last);
}

/** Weekday names in display order. */
export function weekdayLabels(
  weekStartsOn: WeekStart,
  style: "short" | "narrow" = "short",
): string[] {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    weekday: style,
    timeZone: "UTC",
  });
  // 2026-08-16 is a Sunday, so this indexes cleanly from either start day.
  const sunday = new Date(Date.UTC(2026, 7, 16));
  const offset = weekStartsOn === "monday" ? 1 : 0;

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sunday);
    day.setUTCDate(sunday.getUTCDate() + i + offset);
    return formatter.format(day);
  });
}

/**
 * Human date parts for calendar headings. Formatted in UTC because the input
 * is a plain calendar date — converting it to a zone is exactly the bug the
 * whole design avoids.
 */
export function describeDate(date: IsoDate) {
  const dt = toUtc(date);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(dt);

  return {
    weekday: part({ weekday: "short" }),
    weekdayLong: part({ weekday: "long" }),
    day: String(dt.getUTCDate()),
    month: part({ month: "short" }),
    monthLong: part({ month: "long" }),
    year: String(dt.getUTCFullYear()),
  };
}

export function monthLabel(date: IsoDate): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUtc(date));
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** "16th Aug" — a friendly, year-free label for things like a default saved-list name. */
export function ordinalDayMonth(date: IsoDate): string {
  const { day, month } = describeDate(date);
  return `${day}${ordinalSuffix(Number(day))} ${month}`;
}

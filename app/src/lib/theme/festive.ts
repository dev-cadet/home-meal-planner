import type { IsoDate } from "../date-math";
import { FESTIVE_PALETTES } from "./palettes";

/**
 * Pure, client-safe festive-calendar logic — mirrors the `date-math.ts` /
 * `date.ts` split (see that file's header comment): no config, no server-only
 * APIs, so it can be shared with a Client Component if one ever needs it.
 *
 * Each festive palette just names a month (`FESTIVE_PALETTES` in
 * `palettes.ts`) — no per-year date computation. That means at most one
 * festive palette can be active at a time, as long as no two holidays share
 * a month; `festive.test.ts` asserts that invariant directly.
 */

/** Every festive holiday id except those listed (comma-separated) in an opt-out cookie value. */
export function enabledFestiveHolidayIds(optOutCookieValue: string | undefined): Set<string> {
  const disabled = new Set((optOutCookieValue ?? "").split(",").filter(Boolean));
  return new Set(FESTIVE_PALETTES.map((p) => p.id).filter((id) => !disabled.has(id)));
}

/** The festive palette (if any) whose month matches today, among the holidays the user hasn't opted out of. */
export function activeFestiveHolidayId(
  today: IsoDate,
  enabledIds: ReadonlySet<string>,
): string | null {
  const todayMonth = Number(today.slice(5, 7));
  const holiday = FESTIVE_PALETTES.find(
    (p) => enabledIds.has(p.id) && p.month === todayMonth,
  );
  return holiday?.id ?? null;
}

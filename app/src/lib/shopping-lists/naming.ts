import { ordinalDayMonth, type IsoDate } from "../date-math";

/**
 * Default names for a generated list — shared between the page that decides
 * whether to warn about a duplicate save and the action that actually saves,
 * so the two can never drift apart. Duplicate detection is name-based (see
 * `hasShoppingListNamedForUser`): renaming a saved list deliberately breaks
 * the match, so saving the same source again after a rename creates a fresh
 * list rather than warning.
 */

export function defaultShoppingListNameForPlan(planName: string): string {
  return `Plan: ${planName}`;
}

export function defaultShoppingListNameForRange(from: IsoDate, to: IsoDate): string {
  return `${ordinalDayMonth(from)} – ${ordinalDayMonth(to)}`;
}

import type { IsoDate } from "../date-math";
import { activeFestiveHolidayId, enabledFestiveHolidayIds } from "./festive";
import { DEFAULT_STANDARD_PALETTE_ID, isStandardPaletteId } from "./palettes";

/** Raw cookie string values — kept as plain strings (not a Next.js cookie jar) so this stays pure and testable without mocking `next/headers`. */
export interface PaletteCookieValues {
  palette?: string;
  festiveEnabled?: string;
  festiveOptOut?: string;
}

/**
 * Which palette id should be active, in priority order:
 *  1. The live festive holiday, if festive theming is enabled and today
 *     falls in one (and it hasn't been opted out of).
 *  2. The user's chosen standard palette, if the cookie names a real one.
 *  3. `DEFAULT_STANDARD_PALETTE_ID`.
 *
 * Pulled out of `app/layout.tsx` so this precedence logic — the thing every
 * other piece of the theme system ultimately funnels through — is unit
 * testable on its own, the same way `festive.ts` already is.
 */
export function resolvePaletteId(cookieValues: PaletteCookieValues, today: IsoDate): string {
  if (cookieValues.festiveEnabled === "true") {
    const enabled = enabledFestiveHolidayIds(cookieValues.festiveOptOut);
    const active = activeFestiveHolidayId(today, enabled);
    if (active) return active;
  }

  return cookieValues.palette && isStandardPaletteId(cookieValues.palette)
    ? cookieValues.palette
    : DEFAULT_STANDARD_PALETTE_ID;
}

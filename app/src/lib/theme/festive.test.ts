import { describe, expect, test } from "bun:test";

import { activeFestiveHolidayId, enabledFestiveHolidayIds } from "./festive";
import { FESTIVE_PALETTES } from "./palettes";

const ALL_IDS = new Set(FESTIVE_PALETTES.map((p) => p.id));

test("no two festive palettes share a month", () => {
  const months = FESTIVE_PALETTES.map((p) => p.month);
  expect(new Set(months).size).toBe(months.length);
});

describe("enabledFestiveHolidayIds", () => {
  test("everything is enabled when nothing is opted out", () => {
    expect(enabledFestiveHolidayIds(undefined)).toEqual(ALL_IDS);
    expect(enabledFestiveHolidayIds("")).toEqual(ALL_IDS);
  });

  test("removes only the opted-out id", () => {
    const enabled = enabledFestiveHolidayIds("halloween");
    expect(enabled.has("halloween")).toBe(false);
    expect(enabled.has("christmas")).toBe(true);
    expect(enabled.size).toBe(ALL_IDS.size - 1);
  });
});

describe("activeFestiveHolidayId", () => {
  test("matches the holiday whose month is today's", () => {
    expect(activeFestiveHolidayId("2026-10-15", ALL_IDS)).toBe("halloween");
    expect(activeFestiveHolidayId("2026-12-01", ALL_IDS)).toBe("christmas");
  });

  test("returns null outside any festive month", () => {
    expect(activeFestiveHolidayId("2026-01-15", ALL_IDS)).toBeNull();
  });

  test("respects opt-outs", () => {
    const withoutHalloween = enabledFestiveHolidayIds("halloween");
    expect(activeFestiveHolidayId("2026-10-15", withoutHalloween)).toBeNull();
  });
});

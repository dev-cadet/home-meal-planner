import { describe, expect, it } from "bun:test";

import {
  addDays,
  assertIsoDate,
  daysBetween,
  eachDay,
  formatDate,
  isIsoDate,
  startOfWeek,
  todayInAppTimeZone,
  addMonths,
  dayOfWeek,
  describeDate,
  endOfMonth,
  endOfWeek,
  monthGrid,
  startOfMonth,
  weekdayLabels,
} from "./date";

/**
 * The bug these guard against: a container runs UTC, so anywhere ahead of or
 * behind UTC can land on the wrong calendar day. Zones on both sides of UTC
 * are pinned so a UK-only test run can't hide an off-by-one-day error.
 */
describe("todayInAppTimeZone", () => {
  it("resolves the local date, not the UTC date, ahead of UTC", () => {
    // 22:30 UTC on 17 Aug is already 10:30 on 18 Aug in Auckland.
    const instant = new Date("2026-08-17T22:30:00.000Z");

    expect(todayInAppTimeZone(instant, "UTC")).toBe("2026-08-17");
    expect(todayInAppTimeZone(instant, "Pacific/Auckland")).toBe("2026-08-18");
  });

  it("resolves the local date behind UTC", () => {
    // 02:30 UTC on 18 Aug is still 19:30 on 17 Aug in Los Angeles.
    const instant = new Date("2026-08-18T02:30:00.000Z");

    expect(todayInAppTimeZone(instant, "UTC")).toBe("2026-08-18");
    expect(todayInAppTimeZone(instant, "America/Los_Angeles")).toBe("2026-08-17");
  });

  it("handles the UK's BST offset just after midnight", () => {
    // 23:30 UTC on 17 Aug is 00:30 on 18 Aug in London during BST.
    const instant = new Date("2026-08-17T23:30:00.000Z");

    expect(todayInAppTimeZone(instant, "Europe/London")).toBe("2026-08-18");
  });

  it("always returns a valid zero-padded ISO date", () => {
    const instant = new Date("2026-01-05T12:00:00.000Z");
    expect(todayInAppTimeZone(instant, "Europe/London")).toBe("2026-01-05");
  });
});

describe("isIsoDate", () => {
  it("accepts real dates", () => {
    expect(isIsoDate("2026-08-18")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true); // leap year
  });

  it("rejects malformed or impossible dates", () => {
    expect(isIsoDate("2026-8-18")).toBe(false);
    expect(isIsoDate("18/08/2026")).toBe(false);
    expect(isIsoDate("2026-08-18T00:00:00Z")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false); // would roll into March
    expect(isIsoDate("2025-02-29")).toBe(false); // not a leap year
    expect(isIsoDate("2026-13-01")).toBe(false);
  });

  it("throws with the offending value", () => {
    expect(() => assertIsoDate("nope")).toThrow(/nope/);
  });
});

describe("calendar arithmetic", () => {
  it("adds and subtracts days across month and year boundaries", () => {
    expect(addDays("2026-08-18", 1)).toBe("2026-08-19");
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  /**
   * Clocks go forward in the UK on 29 March 2026. Arithmetic done in local
   * time would drop or duplicate a day here; UTC-framed arithmetic cannot.
   */
  it("is unaffected by DST transitions", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(eachDay("2026-03-28", "2026-03-30")).toHaveLength(3);
  });

  it("measures distance between dates", () => {
    expect(daysBetween("2026-08-18", "2026-08-25")).toBe(7);
    expect(daysBetween("2026-08-25", "2026-08-18")).toBe(-7);
    expect(daysBetween("2026-08-18", "2026-08-18")).toBe(0);
  });

  it("enumerates an inclusive range", () => {
    expect(eachDay("2026-08-18", "2026-08-20")).toEqual([
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
    ]);
    expect(eachDay("2026-08-20", "2026-08-18")).toEqual([]);
  });
});

describe("startOfWeek", () => {
  // 2026-08-18 is a Tuesday.
  it("snaps back to Monday", () => {
    expect(startOfWeek("2026-08-18", "monday")).toBe("2026-08-17");
    expect(startOfWeek("2026-08-17", "monday")).toBe("2026-08-17");
    expect(startOfWeek("2026-08-23", "monday")).toBe("2026-08-17"); // Sunday
  });

  it("snaps back to Sunday", () => {
    expect(startOfWeek("2026-08-18", "sunday")).toBe("2026-08-16");
    expect(startOfWeek("2026-08-16", "sunday")).toBe("2026-08-16");
  });
});

describe("formatDate", () => {
  it("renders each supported format", () => {
    expect(formatDate("2026-08-18", "DD/MM/YYYY")).toBe("18/08/2026");
    expect(formatDate("2026-08-18", "MM/DD/YYYY")).toBe("08/18/2026");
    expect(formatDate("2026-08-18", "YYYY-MM-DD")).toBe("2026-08-18");
  });
});

/* ------------------------------------------------------------------ *
 * Calendar helpers
 * ------------------------------------------------------------------ */

describe("month boundaries", () => {
  it("finds the first and last day", () => {
    expect(startOfMonth("2026-08-18")).toBe("2026-08-01");
    expect(endOfMonth("2026-08-18")).toBe("2026-08-31");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2024-02-10")).toBe("2024-02-29"); // leap year
    expect(endOfMonth("2026-04-01")).toBe("2026-04-30");
  });
});

describe("addMonths", () => {
  it("steps forward and back", () => {
    expect(addMonths("2026-08-18", 1)).toBe("2026-09-18");
    expect(addMonths("2026-08-18", -1)).toBe("2026-07-18");
    expect(addMonths("2026-12-18", 1)).toBe("2027-01-18");
    expect(addMonths("2026-01-18", -1)).toBe("2025-12-18");
  });

  /** 31 Jan + 1 month must be end of Feb, not a rollover into March. */
  it("clamps to the shorter month instead of overflowing", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-05-31", 1)).toBe("2026-06-30");
  });
});

describe("monthGrid", () => {
  it("covers whole weeks and starts on the configured day", () => {
    const grid = monthGrid("2026-08-18", "monday");

    expect(grid.length % 7).toBe(0);
    expect(dayOfWeek(grid[0]!)).toBe(1); // Monday
    expect(grid).toContain("2026-08-01");
    expect(grid).toContain("2026-08-31");
    // August 2026 starts on a Saturday, so July leads in.
    expect(grid[0]).toBe("2026-07-27");
  });

  it("shifts when weeks start on Sunday", () => {
    const grid = monthGrid("2026-08-18", "sunday");

    expect(grid.length % 7).toBe(0);
    expect(dayOfWeek(grid[0]!)).toBe(0);
    expect(grid[0]).toBe("2026-07-26");
  });

  it("spans a DST transition without dropping or duplicating a day", () => {
    // UK clocks go forward on 29 March 2026.
    const grid = monthGrid("2026-03-15", "monday");

    expect(new Set(grid).size).toBe(grid.length);
    expect(grid).toContain("2026-03-28");
    expect(grid).toContain("2026-03-29");
    expect(grid).toContain("2026-03-30");
  });
});

describe("weekdayLabels", () => {
  it("orders from the configured start day", () => {
    expect(weekdayLabels("monday")[0]).toBe("Mon");
    expect(weekdayLabels("monday").at(-1)).toBe("Sun");
    expect(weekdayLabels("sunday")[0]).toBe("Sun");
    expect(weekdayLabels("sunday").at(-1)).toBe("Sat");
  });
});

describe("describeDate", () => {
  it("reads a calendar date without timezone conversion", () => {
    const d = describeDate("2026-08-18");
    expect(d.weekdayLong).toBe("Tuesday");
    expect(d.day).toBe("18");
    expect(d.month).toBe("Aug");
    expect(d.year).toBe("2026");
  });

  it("does not shift the day at month boundaries", () => {
    expect(describeDate("2026-01-01").day).toBe("1");
    expect(describeDate("2026-12-31").day).toBe("31");
  });
});

describe("endOfWeek", () => {
  it("is six days after the start", () => {
    expect(endOfWeek("2026-08-18", "monday")).toBe("2026-08-23");
    expect(endOfWeek("2026-08-18", "sunday")).toBe("2026-08-22");
  });
});

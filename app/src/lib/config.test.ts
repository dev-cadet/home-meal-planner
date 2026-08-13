import { describe, expect, it } from "bun:test";

import { configSchema } from "./config";

/**
 * A mistyped timezone silently shifting every date by an hour is worse than a
 * container that refuses to boot, so bad values must fail loudly.
 */
describe("config validation", () => {
  it("supplies defaults for an empty environment", () => {
    const c = configSchema.parse({});

    expect(c.TZ).toBe("Europe/London");
    expect(c.DATE_FORMAT).toBe("DD/MM/YYYY");
    expect(c.MEASUREMENT_SYSTEM).toBe("metric");
    expect(c.WEEK_STARTS_ON).toBe("monday");
    expect(c.ALLOW_REGISTRATION).toBe(false);
    expect(c.INVITE_CODE_TTL_DAYS).toBe(7);
    expect(c.DISABLE_SIGNUPS).toBe(false);
    expect(c.DISABLE_PASSWORD_CHANGES).toBe(false);
    expect(c.SEED_ON_START).toBe(false);
  });

  it("accepts valid IANA time zones", () => {
    for (const TZ of ["UTC", "America/New_York", "Pacific/Auckland"]) {
      expect(configSchema.parse({ TZ }).TZ).toBe(TZ);
    }
  });

  it("rejects an unrecognised time zone with a useful message", () => {
    const result = configSchema.safeParse({ TZ: "Europe/Londn" });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toContain("Europe/Londn");
    expect(result.error!.issues[0]!.message).toMatch(/IANA/);
  });

  it("rejects an unknown date format rather than falling back", () => {
    expect(configSchema.safeParse({ DATE_FORMAT: "DD-MM-YY" }).success).toBe(false);
  });

  it("rejects an unknown measurement system", () => {
    expect(configSchema.safeParse({ MEASUREMENT_SYSTEM: "furlongs" }).success).toBe(
      false,
    );
  });

  it("coerces booleans from environment strings", () => {
    expect(configSchema.parse({ ALLOW_REGISTRATION: "true" }).ALLOW_REGISTRATION).toBe(
      true,
    );
    expect(configSchema.parse({ ALLOW_REGISTRATION: "false" }).ALLOW_REGISTRATION).toBe(
      false,
    );
    // Anything else is a typo, not a falsy value.
    expect(configSchema.safeParse({ ALLOW_REGISTRATION: "yes" }).success).toBe(false);
  });

  it("coerces and bounds the invite TTL", () => {
    expect(configSchema.parse({ INVITE_CODE_TTL_DAYS: "14" }).INVITE_CODE_TTL_DAYS).toBe(
      14,
    );
    expect(configSchema.safeParse({ INVITE_CODE_TTL_DAYS: "0" }).success).toBe(false);
    expect(configSchema.safeParse({ INVITE_CODE_TTL_DAYS: "-1" }).success).toBe(false);
    expect(configSchema.safeParse({ INVITE_CODE_TTL_DAYS: "half" }).success).toBe(false);
  });

  it("coerces the demo-mode booleans", () => {
    expect(configSchema.parse({ DISABLE_SIGNUPS: "true" }).DISABLE_SIGNUPS).toBe(true);
    expect(
      configSchema.parse({ DISABLE_PASSWORD_CHANGES: "true" }).DISABLE_PASSWORD_CHANGES,
    ).toBe(true);
    expect(configSchema.parse({ SEED_ON_START: "true" }).SEED_ON_START).toBe(true);
  });

  it("rejects a too-short auth secret", () => {
    expect(configSchema.safeParse({ BETTER_AUTH_SECRET: "short" }).success).toBe(false);
    expect(
      configSchema.safeParse({ BETTER_AUTH_SECRET: "a".repeat(32) }).success,
    ).toBe(true);
  });
});

import { z } from "zod";

/**
 * Deployment configuration, validated once at startup.
 *
 * Invalid values abort the process rather than falling back to a default. A
 * mistyped timezone silently shifting every date by an hour is far worse than
 * a container that refuses to boot.
 */

const isValidTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const booleanish = (fallback: "true" | "false") =>
  z
    .enum(["true", "false"])
    .default(fallback)
    .transform((v) => v === "true");

const schema = z.object({
  /**
   * IANA zone. Used only at the two boundaries described in docs/plan.md §3:
   * resolving "today", and formatting instants for display.
   */
  TZ: z
    .string()
    .default("Europe/London")
    .superRefine((tz, ctx) => {
      if (!isValidTimeZone(tz)) {
        ctx.addIssue({
          code: "custom",
          message: `"${tz}" is not a recognised IANA time zone (e.g. "Europe/London", "America/New_York")`,
        });
      }
    }),

  DATE_FORMAT: z
    .enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"])
    .default("DD/MM/YYYY"),

  /**
   * Presentation only. Never affects what is stored — each ingredient row
   * keeps the unit it was entered with.
   */
  MEASUREMENT_SYSTEM: z.enum(["metric", "imperial"]).default("metric"),

  WEEK_STARTS_ON: z.enum(["monday", "sunday"]).default("monday"),

  ALLOW_REGISTRATION: booleanish("false"),

  /**
   * A hard stop on top of ALLOW_REGISTRATION/invite codes — for a public demo
   * where nobody but the seeded account should ever be able to sign in. The
   * bootstrap rule (first account ever) still wins over this, so a fresh,
   * empty deployment can never lock itself out; see registration.ts.
   */
  DISABLE_SIGNUPS: booleanish("false"),

  /**
   * Blocks both self-service changes and admin-issued temporary passwords —
   * again a demo-deployment concern, so a visitor can't change the shared
   * credentials out from under everyone else. A forced change already in
   * progress (`mustChangePassword`) is still allowed through, so this can
   * never itself cause a lockout.
   */
  DISABLE_PASSWORD_CHANGES: booleanish("false"),

  /**
   * Re-run the demo seed (scripts/seed.ts's data, via lib/db/seed.ts) on
   * every container start. Destructive — clears and replaces meals, plans and
   * the schedule each time — so this exists for demo deployments that want a
   * clean slate on every restart, never for a real household's data.
   */
  SEED_ON_START: booleanish("false"),

  INVITE_CODE_TTL_DAYS: z.coerce.number().int().positive().default(7),

  DATABASE_PATH: z.string().min(1).default("./data/app.db"),

  /**
   * Where the generated migration SQL lives.
   *
   * Left empty in development, where it is resolved relative to the source
   * file. A standalone build rewrites the module layout, so the container sets
   * this explicitly rather than guessing.
   */
  MIGRATIONS_DIR: z.string().default(""),

  // Optional here on purpose: enforced at the point of use (auth/index.ts)
  // instead, so the data layer and its tests stay runnable without auth
  // configured at all.
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.url().optional(),
});

export type Config = z.infer<typeof schema>;

function load(): Config {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }

  return Object.freeze(parsed.data);
}

export const config = load();

/** Exposed for tests, which need to validate arbitrary environments. */
export const configSchema = schema;

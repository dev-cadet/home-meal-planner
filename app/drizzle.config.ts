import { defineConfig } from "drizzle-kit";

/**
 * `drizzle-kit generate` only reads the schema and emits SQL — it never
 * connects, so no native driver is involved. Migrations are applied at runtime
 * by `src/lib/db/migrate.ts` through the libsql driver.
 */
export default defineConfig({
  dialect: "turso",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: `file:${process.env.DATABASE_PATH ?? "./data/app.db"}`,
  },
  strict: true,
  verbose: true,
});

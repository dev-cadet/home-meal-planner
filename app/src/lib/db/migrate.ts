import { resolve } from "node:path";

import { migrate } from "drizzle-orm/libsql/migrator";

import { config } from "../config";

import type { DatabaseHandle } from "./client";

/**
 * Where the migration SQL lives.
 *
 * Resolved from the working directory, not from this file. A static
 * `new URL("...", import.meta.url)` looks like a module reference to the
 * bundler and fails the build; the working directory is `app/` for both the
 * dev server and the scripts, so `./drizzle` is correct there.
 *
 * A standalone build runs from a different layout, so the container sets
 * `MIGRATIONS_DIR` explicitly rather than relying on this.
 */
export const MIGRATIONS_FOLDER =
  config.MIGRATIONS_DIR || resolve(process.cwd(), "drizzle");

/**
 * Apply any pending migrations.
 *
 * Run at container boot before the server accepts traffic, and by tests
 * against their throwaway databases. drizzle-kit only *generates* SQL — it
 * never connects — so this is the sole path that touches a real database.
 */
export async function runMigrations(
  handle: DatabaseHandle,
  migrationsFolder: string = MIGRATIONS_FOLDER,
): Promise<void> {
  await migrate(handle.db, { migrationsFolder });
}

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import { config } from "../config";
import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema>;

export interface DatabaseHandle {
  db: Database;
  client: Client;
  close: () => void;
}

/**
 * Applied to every connection, in this order.
 *
 * `foreign_keys` is the load-bearing one: SQLite ignores foreign keys by
 * default, which would silently turn every `ON DELETE SET NULL` into a no-op
 * and leave dangling author IDs behind a deleted user. Nothing would error —
 * it would just quietly corrupt. There is a test pinning this.
 *
 * These run sequentially rather than batched: `journal_mode` cannot be changed
 * inside a transaction, and `client.batch()` wraps its statements in one.
 */
const PRAGMAS = [
  // MUST be first. Switching journal mode needs an exclusive lock, so it is
  // the statement most likely to contend with another process opening the
  // same file — and without a busy timeout already in force it fails
  // immediately with SQLITE_BUSY instead of waiting its turn.
  "PRAGMA busy_timeout = 5000",
  "PRAGMA journal_mode = WAL",
  "PRAGMA foreign_keys = ON",
  "PRAGMA synchronous = NORMAL",
] as const;

async function applyPragmas(client: Client): Promise<void> {
  for (const pragma of PRAGMAS) {
    await client.execute(pragma);
  }
}

/**
 * Build an isolated database handle.
 *
 * ⚠️ `:memory:` is unsafe with transactions. A libsql write transaction
 * against an in-memory database destroys it — every table is gone once the
 * transaction commits, and the next query fails with "no such table". File
 * databases are unaffected. Tests should use `createTestDatabase()` from
 * `./testing`, which uses a temp file for exactly this reason.
 */
export async function createDatabase(
  path: string = config.DATABASE_PATH,
): Promise<DatabaseHandle> {
  const inMemory = path === ":memory:";

  if (!inMemory) {
    // Create the containing directory, not the file — WAL needs to write
    // its -wal and -shm sidecars alongside the database.
    mkdirSync(dirname(path), { recursive: true });
  }

  const client = createClient({ url: inMemory ? ":memory:" : `file:${path}` });
  await applyPragmas(client);

  return {
    client,
    db: drizzle(client, { schema }),
    close: () => client.close(),
  };
}

/* ------------------------------------------------------------------ *
 * App singleton
 *
 * Cached on globalThis so Next's dev hot-reload doesn't leak a new
 * connection (and a new WAL lock) on every edit.
 * ------------------------------------------------------------------ */

const globalForDb = globalThis as unknown as {
  __mealPlannerDb?: Promise<DatabaseHandle>;
};

export function getDatabase(): Promise<DatabaseHandle> {
  globalForDb.__mealPlannerDb ??= createDatabase();
  return globalForDb.__mealPlannerDb;
}

/** Convenience for the common case where only the query builder is needed. */
export async function getDb(): Promise<Database> {
  return (await getDatabase()).db;
}

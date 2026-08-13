/**
 * Back up the database to a single file.
 *
 *   bun run db:backup                  # ./backups/app-YYYY-MM-DD-HHmm.db
 *   bun run db:backup /path/to/out.db
 *
 * Uses SQLite's `VACUUM INTO`, which takes a consistent snapshot of a live
 * database — no need to stop the app. Copying the file by hand is not
 * equivalent: with WAL enabled the newest writes live in `app.db-wal`, so a
 * plain copy of `app.db` can silently miss them.
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { config } from "../src/lib/config";
import { createDatabase } from "../src/lib/db/client";

function defaultTarget(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return resolve(`./backups/app-${stamp}.db`);
}

const target = process.argv[2] ? resolve(process.argv[2]) : defaultTarget();
mkdirSync(dirname(target), { recursive: true });

const handle = await createDatabase();

try {
  console.log(`Backing up ${config.DATABASE_PATH}`);
  // Single-quoted SQL literal; the path is operator-supplied, not user input.
  await handle.client.execute(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  console.log(`Wrote ${target}`);
  console.log(
    "\nRestore by stopping the app and copying this file over app.db\n" +
      "(delete any app.db-wal and app.db-shm beside it first).",
  );
} finally {
  handle.close();
}

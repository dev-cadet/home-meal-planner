import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDatabase, type DatabaseHandle } from "./client";
import { runMigrations } from "./migrate";

export interface TestDatabase extends DatabaseHandle {
  /** Close the connection and remove the temporary directory. */
  cleanup: () => void;
}

/**
 * A migrated, throwaway database on a real file.
 *
 * **Deliberately not `:memory:`.** A libsql write transaction against an
 * in-memory database destroys it — every table vanishes once the transaction
 * commits, and the next query fails with "no such table". File-backed
 * databases are unaffected (commit and rollback both verified), so tests use
 * files and match production while they are at it.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const dir = mkdtempSync(join(tmpdir(), "hmp-test-"));
  const handle = await createDatabase(join(dir, "app.db"));
  await runMigrations(handle);

  return {
    ...handle,
    cleanup() {
      handle.close();
      try {
        // Windows holds the file briefly after close; tidying is not the
        // thing under test, so never let it fail a suite.
        rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      } catch {
        // Left for the OS to reclaim.
      }
    },
  };
}

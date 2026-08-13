/**
 * Apply pending migrations. Run manually in development, and at container
 * boot before the server accepts traffic.
 */
import { config } from "../src/lib/config";
import { createDatabase } from "../src/lib/db/client";
import { MIGRATIONS_FOLDER, runMigrations } from "../src/lib/db/migrate";

const handle = await createDatabase();

try {
  console.log(`Migrating ${config.DATABASE_PATH}`);
  console.log(`  from ${MIGRATIONS_FOLDER}`);
  await runMigrations(handle);
  console.log("Migrations applied.");
} finally {
  handle.close();
}

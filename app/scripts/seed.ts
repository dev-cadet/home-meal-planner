/**
 * CLI wrapper for the demo seed data.
 *
 * The same data loads automatically at container boot when SEED_ON_START is
 * set (see src/instrumentation.ts) — this is for local/manual use, and for
 * seeding a fresh dev database.
 *
 * Destructive by design — never run against real data.
 */
import { count } from "drizzle-orm";

import { config } from "../src/lib/config";
import { createDatabase } from "../src/lib/db/client";
import { user } from "../src/lib/db/schema";
import { seedDatabase } from "../src/lib/db/seed";
import { runMigrations } from "../src/lib/db/migrate";

const handle = await createDatabase();

try {
  await runMigrations(handle);
  const { db } = handle;

  console.log(`Seeding ${config.DATABASE_PATH}`);

  const summary = await seedDatabase(db, config.INVITE_CODE_TTL_DAYS);

  console.log(`  ${summary.meals} meals`);
  console.log(`  ${summary.ingredients} ingredients`);
  console.log(`  ${summary.imagesLoaded}/${summary.meals} images loaded from picsum.photos`);
  console.log(`  ${summary.plans} plans`);
  console.log(`  ${summary.scheduled} scheduled meals from ${summary.scheduledFrom}`);
  console.log(`  attributed to: ${summary.attributedTo}`);
  console.log(`  invite code: ${summary.inviteCode}`);

  const [{ n: userCount }] = await db.select({ n: count() }).from(user);
  console.log(
    userCount === 0
      ? "\nNo accounts exist. Sign up at /sign-up — the first account becomes admin."
      : `\n${userCount} account(s) exist. Sign up needs the invite code above.`,
  );
} finally {
  handle.close();
}

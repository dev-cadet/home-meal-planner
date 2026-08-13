/**
 * Server startup hook.
 *
 * Next calls `register` exactly once per server instance and waits for it to
 * finish **before the server accepts requests** — which is precisely the
 * guarantee migrations need. Doing this here rather than in a shell entrypoint
 * also means the migration code is traced into the standalone bundle
 * automatically, and the ordering is enforced by the framework instead of by
 * my own script.
 */
export async function register(): Promise<void> {
  // Skip the edge runtime; the database is Node-only.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // `next build` also initialises a server to collect page data. Migrating
  // there would create a stray database inside the build image.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { config } = await import("./lib/config");
  const { getDatabase } = await import("./lib/db/client");
  const { runMigrations, MIGRATIONS_FOLDER } = await import("./lib/db/migrate");

  const handle = await getDatabase();

  const started = Date.now();
  await runMigrations(handle);
  console.log(
    `[startup] migrations applied from ${MIGRATIONS_FOLDER} in ${Date.now() - started}ms`,
  );

  // Opt-in, and destructive: clears and reloads the demo dataset on every
  // boot. Exists for public demo deployments that want a clean slate on
  // every restart — never enable this against real data.
  if (config.SEED_ON_START) {
    const { seedDatabase } = await import("./lib/db/seed");
    const seedStarted = Date.now();
    const summary = await seedDatabase(handle.db, config.INVITE_CODE_TTL_DAYS);
    console.log(
      `[startup] SEED_ON_START: reset to ${summary.meals} meals, ${summary.plans} plans in ${Date.now() - seedStarted}ms`,
    );
  }
}

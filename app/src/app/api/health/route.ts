import { sql } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";

/**
 * Container healthcheck.
 *
 * Deliberately unauthenticated — Docker has no session — and excluded from the
 * proxy matcher so it is reachable while signed out.
 *
 * It runs a real query rather than just returning 200. A process that is up
 * but cannot reach its database is not healthy, and an endpoint that cannot
 * tell the difference is worse than none.
 */
export async function GET(): Promise<Response> {
  const startedAt = Date.now();

  try {
    const { db } = await getDatabase();
    await db.get(sql`select 1`);

    return Response.json(
      { status: "ok", database: "ok", ms: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        status: "error",
        database: "unreachable",
        message: error instanceof Error ? error.message : "unknown",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

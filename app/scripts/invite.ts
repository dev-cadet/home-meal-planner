/**
 * Generate an invite code from the command line.
 *
 * The in-app equivalent is Settings → Invite codes (admin only). This script
 * exists for scripted/headless setups, or for before anyone has signed in —
 * without it, the only other way to mint a code is `db:seed`, which wipes
 * all content first.
 *
 *   bun run db:invite          # one code, default TTL
 *   bun run db:invite 3        # three codes
 */
import { count } from "drizzle-orm";

import { config } from "../src/lib/config";
import { createDatabase } from "../src/lib/db/client";
import { inviteCode as inviteCodeTable, user } from "../src/lib/db/schema";
import { inviteCode } from "../src/lib/id";

const howMany = Math.max(1, Number(process.argv[2] ?? 1) || 1);

const handle = await createDatabase();

try {
  const { db } = handle;
  const expiresAt = new Date(
    Date.now() + config.INVITE_CODE_TTL_DAYS * 86_400_000,
  );

  const codes = Array.from({ length: howMany }, () => inviteCode());
  await db
    .insert(inviteCodeTable)
    .values(codes.map((code) => ({ code, expiresAt })));

  const [row] = await db.select({ n: count() }).from(user);

  for (const code of codes) console.log(code);
  console.log(
    `\nExpires ${expiresAt.toISOString().slice(0, 10)} (${config.INVITE_CODE_TTL_DAYS} days).`,
  );

  if ((row?.n ?? 0) === 0) {
    console.log(
      "Note: no accounts exist yet, so the next sign-up needs no code at all —\n" +
        "it takes the bootstrap grant and becomes admin.",
    );
  }
} finally {
  handle.close();
}

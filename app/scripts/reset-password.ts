/**
 * Set a user's password from the command line.
 *
 *   bun run reset-password test@test.com
 *   bun run reset-password test@test.com "a-password-i-chose"
 *
 * The escape hatch for the one failure the app cannot fix by itself: there is
 * no SMTP, so a forgotten password normally needs an admin — and if the *only*
 * admin forgets theirs, nobody can get in at all.
 *
 * Running it requires shell access to the container, which is its own
 * authorisation.
 */
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import { createDatabase } from "../src/lib/db/client";
import { account, session, user } from "../src/lib/db/schema";
import { inviteCode as randomToken } from "../src/lib/id";

const email = process.argv[2]?.trim().toLowerCase();
const supplied = process.argv[3];

if (!email) {
  console.error("Usage: bun run reset-password <email> [new-password]");
  process.exit(1);
}

const handle = await createDatabase();

try {
  const { db } = handle;

  const [target] = await db.select().from(user).where(eq(user.email, email));
  if (!target) {
    console.error(`No account with the email ${email}.`);
    const all = await db.select({ email: user.email }).from(user);
    if (all.length > 0) {
      console.error("Known accounts:");
      for (const u of all) console.error(`  ${u.email}`);
    }
    process.exit(1);
  }

  const password =
    supplied ??
    `${randomToken(4)}-${randomToken(4)}-${randomToken(4)}`.toLowerCase();

  const result = await db
    .update(account)
    .set({ password: await hashPassword(password) })
    .where(
      and(eq(account.userId, target.id), eq(account.providerId, "credential")),
    );

  if (Number(result.rowsAffected ?? 0) === 0) {
    console.error("That account has no password credential to reset.");
    process.exit(1);
  }

  // Only force a change when the password was generated here; one the operator
  // chose themselves is already theirs.
  await db
    .update(user)
    .set({ mustChangePassword: supplied === undefined })
    .where(eq(user.id, target.id));

  // Existing sessions were opened with the old password.
  await db.delete(session).where(eq(session.userId, target.id));

  console.log(`Password set for ${target.name} <${target.email}>.`);
  if (supplied === undefined) {
    console.log(`\n  ${password}\n`);
    console.log("They will be asked to choose a new one at next sign-in.");
  }
  console.log("Any existing sessions were signed out.");
} finally {
  handle.close();
}

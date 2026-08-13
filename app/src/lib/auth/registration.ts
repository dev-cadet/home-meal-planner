import { and, count, eq, gt, isNull, sql } from "drizzle-orm";

import type { Database } from "../db/client";
import { inviteCode as inviteCodeTable, user } from "../db/schema";

/**
 * Who is allowed to create an account.
 *
 * Three rules, resolved in this order:
 *
 *   1. No users exist yet  → allowed unconditionally; this account becomes admin.
 *   2. ALLOW_REGISTRATION  → open sign-up.
 *   3. Otherwise           → a valid, unused, unexpired invite code is required.
 *
 * Rule 1 is a deliberate anti-lockout measure. Deploying with registration
 * disabled against an empty database would otherwise produce an app nobody can
 * ever sign into: no account to log in as, and no admin to issue an invite. It
 * closes permanently the moment the first account exists.
 */

export type RegistrationOutcome =
  | { allowed: true; grant: "bootstrap" | "open" | "invite"; code?: string }
  | { allowed: false; reason: RegistrationDenial; message: string };

export type RegistrationDenial =
  | "signups_disabled"
  | "invite_required"
  | "invite_unknown"
  | "invite_expired"
  | "invite_used";

export async function countUsers(db: Database): Promise<number> {
  const [row] = await db.select({ n: count() }).from(user);
  return row?.n ?? 0;
}

export type RegistrationMode = "bootstrap" | "open" | "invite" | "disabled";

/**
 * Which rule currently applies, without consuming anything.
 *
 * Used by the sign-up page to decide whether to show the invite field — the
 * read-only counterpart to `evaluateRegistration`, which has side effects.
 */
export async function registrationMode(
  db: Database,
  allowRegistration: boolean,
  disableSignups = false,
): Promise<RegistrationMode> {
  if ((await countUsers(db)) === 0) return "bootstrap";
  if (disableSignups) return "disabled";
  return allowRegistration ? "open" : "invite";
}

/**
 * Atomically consume an invite code.
 *
 * The guard lives in the WHERE clause, so claiming is a single statement and
 * two concurrent sign-ups cannot both succeed — exactly one sees a row
 * affected. Checking first and updating afterwards would leave a race window
 * where a code could be redeemed twice.
 */
export async function claimInviteCode(
  db: Database,
  code: string,
  userId: string | null,
  now: Date = new Date(),
): Promise<boolean> {
  const result = await db
    .update(inviteCodeTable)
    .set({ usedAt: now, usedById: userId })
    .where(
      and(
        eq(inviteCodeTable.code, code),
        isNull(inviteCodeTable.usedAt),
        gt(inviteCodeTable.expiresAt, now),
      ),
    );

  return Number(result.rowsAffected ?? 0) === 1;
}

/** Why a claim failed, for a message that actually helps the user. */
async function diagnoseInvite(
  db: Database,
  code: string,
  now: Date,
): Promise<Extract<RegistrationOutcome, { allowed: false }>> {
  const [row] = await db
    .select()
    .from(inviteCodeTable)
    .where(eq(inviteCodeTable.code, code));

  if (!row) {
    return {
      allowed: false,
      reason: "invite_unknown",
      message: "That invite code was not recognised.",
    };
  }
  if (row.usedAt !== null) {
    return {
      allowed: false,
      reason: "invite_used",
      message: "That invite code has already been used.",
    };
  }
  if (row.expiresAt <= now) {
    return {
      allowed: false,
      reason: "invite_expired",
      message: "That invite code has expired. Ask an admin for a new one.",
    };
  }
  // Lost a concurrent race between the claim and this lookup.
  return {
    allowed: false,
    reason: "invite_used",
    message: "That invite code has already been used.",
  };
}

export interface RegistrationInput {
  db: Database;
  inviteCode?: string | null;
  allowRegistration: boolean;
  /**
   * A hard stop above ALLOW_REGISTRATION/invite codes, for public demos. Does
   * not override the bootstrap rule below — that stays the anti-lockout
   * backstop regardless.
   */
  disableSignups?: boolean;
  now?: Date;
}

/**
 * Decide whether a sign-up may proceed, consuming the invite code if one is
 * required. Call this *before* creating the user.
 *
 * Trade-off worth knowing: the code is claimed before the account exists, so a
 * sign-up that subsequently fails burns the code and an admin must issue
 * another. That is the safer direction to fail — the alternative risks two
 * people sharing one invite.
 */
export async function evaluateRegistration({
  db,
  inviteCode,
  allowRegistration,
  disableSignups = false,
  now = new Date(),
}: RegistrationInput): Promise<RegistrationOutcome> {
  if ((await countUsers(db)) === 0) {
    return { allowed: true, grant: "bootstrap" };
  }

  if (disableSignups) {
    return {
      allowed: false,
      reason: "signups_disabled",
      message: "Sign-up is disabled on this instance.",
    };
  }

  if (allowRegistration) {
    return { allowed: true, grant: "open" };
  }

  const code = inviteCode?.trim();
  if (!code) {
    return {
      allowed: false,
      reason: "invite_required",
      message: "Sign-up is invite only. Enter an invite code to continue.",
    };
  }

  const claimed = await claimInviteCode(db, code, null, now);
  if (!claimed) {
    return diagnoseInvite(db, code, now);
  }

  return { allowed: true, grant: "invite", code };
}

/** Attach the new account to the code it redeemed, once that account exists. */
export async function attachInviteToUser(
  db: Database,
  code: string,
  userId: string,
): Promise<void> {
  await db
    .update(inviteCodeTable)
    .set({ usedById: userId })
    .where(eq(inviteCodeTable.code, code));
}

/**
 * Promote the very first account to admin.
 *
 * Conditional on there being exactly one user, so a race between two initial
 * sign-ups cannot mint two admins.
 */
export async function promoteFirstUser(
  db: Database,
  userId: string,
): Promise<boolean> {
  const result = await db
    .update(user)
    .set({ isAdmin: true })
    .where(
      and(
        eq(user.id, userId),
        sql`(SELECT COUNT(*) FROM ${user}) = 1`,
      ),
    );

  return Number(result.rowsAffected ?? 0) === 1;
}

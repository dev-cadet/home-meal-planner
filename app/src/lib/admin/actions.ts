"use server";

import { hashPassword } from "better-auth/crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "../auth/dal";
import { getDb } from "../db/client";
import { account, inviteCode, session, user } from "../db/schema";
import { config } from "../config";
import { inviteCode as generateCode } from "../id";

export interface AdminState {
  error?: string;
  notice?: string;
  /** Shown once, never stored — the admin has to pass it on. */
  secret?: string;
}

/* ------------------------------------------------------------------ *
 * Invite codes
 * ------------------------------------------------------------------ */

export async function createInviteAction(): Promise<void> {
  const admin = await requireAdmin();
  const db = await getDb();

  await db.insert(inviteCode).values({
    code: generateCode(),
    createdById: admin.id,
    expiresAt: new Date(Date.now() + config.INVITE_CODE_TTL_DAYS * 86_400_000),
  });

  revalidatePath("/settings");
}

/**
 * Revoke by deleting. Only unused codes can be revoked — a redeemed one is the
 * audit record of how an account came to exist, so it stays.
 */
export async function revokeInviteAction(code: string): Promise<void> {
  await requireAdmin();
  const db = await getDb();

  await db
    .delete(inviteCode)
    // isNull, not eq(..., null): `= NULL` is never true in SQL, so an eq here
    // would silently revoke nothing.
    .where(and(eq(inviteCode.code, code), isNull(inviteCode.usedAt)));

  revalidatePath("/settings");
}

/* ------------------------------------------------------------------ *
 * User management
 * ------------------------------------------------------------------ */

/** Unambiguous to read aloud or type: no 0/O/1/I/L. */
function temporaryPassword(): string {
  return `${generateCode(4)}-${generateCode(4)}-${generateCode(4)}`.toLowerCase();
}

/**
 * Give a user a temporary password.
 *
 * The hash is produced by Better Auth's own `hashPassword` from
 * `better-auth/crypto` — the same function its credential provider verifies
 * against — and written straight to the account row. Verified end to end: the
 * old password stops working and the new one signs in.
 *
 * Chosen over the admin plugin deliberately. That plugin brings its own `role`
 * column, which would leave two competing answers to "is this user an admin?"
 * alongside the existing `isAdmin`.
 */
export async function resetUserPasswordAction(
  userId: string,
): Promise<AdminState> {
  await requireAdmin();

  if (config.DISABLE_PASSWORD_CHANGES) {
    return { error: "Password changes are disabled on this instance." };
  }

  const db = await getDb();

  const [target] = await db.select().from(user).where(eq(user.id, userId));
  if (!target) return { error: "That account no longer exists." };

  const temporary = temporaryPassword();
  const hashed = await hashPassword(temporary);

  const result = await db
    .update(account)
    .set({ password: hashed })
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));

  if (Number(result.rowsAffected ?? 0) === 0) {
    return { error: "That account has no password to reset." };
  }

  await db
    .update(user)
    .set({ mustChangePassword: true })
    .where(eq(user.id, userId));

  // Any session opened with the old password must not survive a reset.
  await db.delete(session).where(eq(session.userId, userId));

  revalidatePath("/settings");

  return {
    notice: `Temporary password for ${target.name}. They will be asked to change it on next sign-in.`,
    secret: temporary,
  };
}

/**
 * Delete a user.
 *
 * Their content stays: every author reference is `ON DELETE SET NULL`, so
 * meals, plans and schedule entries survive and simply show "a deleted user".
 * This is the requirement the whole soft-reference design exists for.
 */
export async function deleteUserAction(userId: string): Promise<AdminState> {
  const admin = await requireAdmin();

  if (admin.id === userId) {
    return { error: "You cannot delete your own account." };
  }

  const db = await getDb();
  const [target] = await db.select().from(user).where(eq(user.id, userId));
  if (!target) return { error: "That account no longer exists." };

  // Guard against removing the last admin and locking everyone out of Settings.
  if (target.isAdmin) {
    const admins = await db.select({ id: user.id }).from(user).where(eq(user.isAdmin, true));
    if (admins.length <= 1) {
      return { error: "That is the only admin. Promote someone else first." };
    }
  }

  await db.delete(user).where(eq(user.id, userId));
  revalidatePath("/settings");

  return { notice: `${target.name} was removed. Their meals and plans were kept.` };
}

export async function setAdminAction(
  userId: string,
  makeAdmin: boolean,
): Promise<AdminState> {
  const admin = await requireAdmin();
  const db = await getDb();

  if (admin.id === userId && !makeAdmin) {
    return { error: "You cannot remove your own admin access." };
  }

  await db.update(user).set({ isAdmin: makeAdmin }).where(eq(user.id, userId));
  revalidatePath("/settings");

  return { notice: makeAdmin ? "Admin access granted." : "Admin access removed." };
}

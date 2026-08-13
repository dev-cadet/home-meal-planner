import "server-only";

import { asc, count, desc, eq, isNull, sql } from "drizzle-orm";

import { requireAdmin } from "../auth/dal";
import { getDb } from "../db/client";
import {
  inviteCode,
  meal,
  plan,
  scheduleEntry,
  user,
} from "../db/schema";

/** Every read here is admin-only; `requireAdmin()` interrupts with 403. */

export async function listUsers() {
  await requireAdmin();
  const db = await getDb();

  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.createdAt));
}

export type InviteStatus = "active" | "used" | "expired";

/**
 * Status is resolved here rather than in the component: "has it expired?"
 * depends on the current time, and reading the clock during render is impure —
 * two renders of the same data could disagree.
 */
export async function listInviteCodes() {
  await requireAdmin();
  const db = await getDb();

  const redeemer = sql<string | null>`(
    select ${user.name} from ${user} where ${user.id} = ${inviteCode.usedById}
  )`.as("redeemer");

  const rows = await db
    .select({
      code: inviteCode.code,
      expiresAt: inviteCode.expiresAt,
      usedAt: inviteCode.usedAt,
      createdAt: inviteCode.createdAt,
      redeemer,
    })
    .from(inviteCode)
    .orderBy(desc(inviteCode.createdAt));

  const now = Date.now();

  return rows.map((row) => ({
    ...row,
    status: (row.usedAt
      ? "used"
      : row.expiresAt.getTime() <= now
        ? "expired"
        : "active") satisfies InviteStatus as InviteStatus,
  }));
}

export async function unusedInviteCount(): Promise<number> {
  await requireAdmin();
  const db = await getDb();

  const [row] = await db
    .select({ n: count() })
    .from(inviteCode)
    .where(isNull(inviteCode.usedAt));

  return row?.n ?? 0;
}

/**
 * What a user has contributed. Shown before deleting them, to make the point
 * that the content survives — author references are nulled, never cascaded.
 */
export async function userContributions(userId: string) {
  await requireAdmin();
  const db = await getDb();

  const countWhere = async (table: typeof meal | typeof plan | typeof scheduleEntry) => {
    const [row] = await db
      .select({ n: count() })
      .from(table)
      .where(eq(table.createdById, userId));
    return row?.n ?? 0;
  };

  return {
    meals: await countWhere(meal),
    plans: await countWhere(plan),
    scheduled: await countWhere(scheduleEntry),
  };
}

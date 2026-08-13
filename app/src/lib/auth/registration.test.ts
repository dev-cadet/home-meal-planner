import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createTestDatabase, type TestDatabase } from "../db/testing";
import { eq } from "drizzle-orm";

import { inviteCode as inviteCodeTable, user } from "../db/schema";
import { uuidv7 } from "../id";
import {
  attachInviteToUser,
  claimInviteCode,
  countUsers,
  evaluateRegistration,
  promoteFirstUser,
  registrationMode,
} from "./registration";

let handle: TestDatabase;

const NOW = new Date("2026-08-14T12:00:00.000Z");
const LATER = new Date("2026-08-30T12:00:00.000Z");

async function addUser(name = "Existing") {
  const id = uuidv7();
  await handle.db
    .insert(user)
    .values({ id, name, email: `${id}@example.test` });
  return id;
}

async function addCode(
  code: string,
  opts: { expiresAt?: Date; usedAt?: Date | null } = {},
) {
  await handle.db.insert(inviteCodeTable).values({
    code,
    expiresAt: opts.expiresAt ?? LATER,
    usedAt: opts.usedAt ?? null,
  });
}

beforeEach(async () => {
  handle = await createTestDatabase();
});

afterEach(() => {
  handle.cleanup();
});

describe("bootstrap rule", () => {
  it("allows the first account even with registration disabled", async () => {
    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      now: NOW,
    });

    expect(outcome).toEqual({ allowed: true, grant: "bootstrap" });
  });

  it("does not require an invite code for the first account", async () => {
    expect(await countUsers(handle.db)).toBe(0);

    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      inviteCode: undefined,
      now: NOW,
    });

    expect(outcome.allowed).toBe(true);
  });

  /** The whole point of the rule: a fresh deployment can never lock you out. */
  it("closes as soon as one account exists", async () => {
    await addUser();

    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      now: NOW,
    });

    expect(outcome.allowed).toBe(false);
  });
});

describe("disableSignups", () => {
  it("still allows the first account, even with disableSignups on", async () => {
    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      disableSignups: true,
      now: NOW,
    });

    expect(outcome).toEqual({ allowed: true, grant: "bootstrap" });
  });

  it("blocks a later sign-up even with an open-registration flag", async () => {
    await addUser();

    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: true,
      disableSignups: true,
      now: NOW,
    });

    expect(outcome).toMatchObject({ allowed: false, reason: "signups_disabled" });
  });

  it("blocks a later sign-up even with a valid invite code", async () => {
    await addUser();
    await addCode("GOOD123456");

    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      disableSignups: true,
      inviteCode: "GOOD123456",
      now: NOW,
    });

    expect(outcome).toMatchObject({ allowed: false, reason: "signups_disabled" });

    // The code must not have been consumed by a sign-up that was never allowed.
    const [row] = await handle.db
      .select()
      .from(inviteCodeTable)
      .where(eq(inviteCodeTable.code, "GOOD123456"));
    expect(row!.usedAt).toBeNull();
  });
});

describe("open registration", () => {
  it("allows sign-up without a code when the flag is on", async () => {
    await addUser();

    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: true,
      now: NOW,
    });

    expect(outcome).toEqual({ allowed: true, grant: "open" });
  });
});

describe("invite-only registration", () => {
  beforeEach(async () => {
    await addUser();
  });

  it("rejects a missing code", async () => {
    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      now: NOW,
    });

    expect(outcome).toMatchObject({ allowed: false, reason: "invite_required" });
  });

  it("rejects an unknown code", async () => {
    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      inviteCode: "NOPE123456",
      now: NOW,
    });

    expect(outcome).toMatchObject({ allowed: false, reason: "invite_unknown" });
  });

  it("rejects an expired code", async () => {
    await addCode("EXPIRED123", {
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      inviteCode: "EXPIRED123",
      now: NOW,
    });

    expect(outcome).toMatchObject({ allowed: false, reason: "invite_expired" });
  });

  it("rejects an already-used code", async () => {
    await addCode("USED123456", { usedAt: new Date("2026-08-10T00:00:00.000Z") });

    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      inviteCode: "USED123456",
      now: NOW,
    });

    expect(outcome).toMatchObject({ allowed: false, reason: "invite_used" });
  });

  it("accepts a valid code and consumes it", async () => {
    await addCode("GOOD123456");

    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      inviteCode: "GOOD123456",
      now: NOW,
    });

    expect(outcome).toMatchObject({ allowed: true, grant: "invite" });

    const [row] = await handle.db
      .select()
      .from(inviteCodeTable)
      .where(eq(inviteCodeTable.code, "GOOD123456"));

    expect(row!.usedAt).toEqual(NOW);
  });

  it("tolerates surrounding whitespace", async () => {
    await addCode("GOOD123456");

    const outcome = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      inviteCode: "  GOOD123456  ",
      now: NOW,
    });

    expect(outcome.allowed).toBe(true);
  });

  it("cannot redeem the same code twice", async () => {
    await addCode("ONCE123456");

    const first = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      inviteCode: "ONCE123456",
      now: NOW,
    });
    const second = await evaluateRegistration({
      db: handle.db,
      allowRegistration: false,
      inviteCode: "ONCE123456",
      now: NOW,
    });

    expect(first.allowed).toBe(true);
    expect(second).toMatchObject({ allowed: false, reason: "invite_used" });
  });
});

describe("registrationMode", () => {
  it("is bootstrap before any account exists, even with disableSignups on", async () => {
    expect(await registrationMode(handle.db, false, true)).toBe("bootstrap");
  });

  it("is disabled once an account exists and disableSignups is on", async () => {
    await addUser();
    expect(await registrationMode(handle.db, true, true)).toBe("disabled");
  });

  it("falls back to open/invite once an account exists and disableSignups is off", async () => {
    await addUser();
    expect(await registrationMode(handle.db, true, false)).toBe("open");
    expect(await registrationMode(handle.db, false, false)).toBe("invite");
  });
});

describe("claimInviteCode", () => {
  /**
   * The guard is in the WHERE clause, so concurrent claims resolve to exactly
   * one winner. A check-then-update would let both through.
   */
  it("lets exactly one of several concurrent claims win", async () => {
    await addCode("RACE123456");

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        claimInviteCode(handle.db, "RACE123456", null, NOW),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("refuses an expired code", async () => {
    await addCode("OLD1234567", {
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    expect(await claimInviteCode(handle.db, "OLD1234567", null, NOW)).toBe(false);
  });
});

describe("attachInviteToUser", () => {
  it("records who redeemed the code", async () => {
    await addCode("LINK123456");
    await claimInviteCode(handle.db, "LINK123456", null, NOW);

    const userId = await addUser("Redeemer");
    await attachInviteToUser(handle.db, "LINK123456", userId);

    const [row] = await handle.db
      .select()
      .from(inviteCodeTable)
      .where(eq(inviteCodeTable.code, "LINK123456"));

    expect(row!.usedById).toBe(userId);
  });

  it("survives the redeeming user being deleted", async () => {
    await addCode("LINK123456");
    const userId = await addUser("Redeemer");
    await attachInviteToUser(handle.db, "LINK123456", userId);

    await handle.db.delete(user).where(eq(user.id, userId));

    const [row] = await handle.db
      .select()
      .from(inviteCodeTable)
      .where(eq(inviteCodeTable.code, "LINK123456"));

    expect(row).toBeDefined();
    expect(row!.usedById).toBeNull();
  });
});

describe("promoteFirstUser", () => {
  it("promotes the only account to admin", async () => {
    const userId = await addUser("First");

    expect(await promoteFirstUser(handle.db, userId)).toBe(true);

    const [row] = await handle.db.select().from(user).where(eq(user.id, userId));
    expect(row!.isAdmin).toBe(true);
  });

  it("refuses once a second account exists", async () => {
    await addUser("First");
    const second = await addUser("Second");

    expect(await promoteFirstUser(handle.db, second)).toBe(false);

    const [row] = await handle.db.select().from(user).where(eq(user.id, second));
    expect(row!.isAdmin).toBe(false);
  });
});

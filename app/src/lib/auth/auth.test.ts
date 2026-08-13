import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createTestDatabase, type TestDatabase } from "../db/testing";
import { eq } from "drizzle-orm";

import { inviteCode as inviteCodeTable, user } from "../db/schema";
import { createAuth, INVITE_HEADER, type Auth } from "./index";

const SECRET = "test-secret-".padEnd(48, "0");
const PASSWORD = "correct-horse-battery-staple";

let handle: TestDatabase;

function makeAuth(allowRegistration: boolean, disableSignups = false): Auth {
  return createAuth(handle.db, { allowRegistration, disableSignups, secret: SECRET });
}

/**
 * A rejection from a `before` hook propagates as a thrown APIError rather than
 * being converted into a Response, even with `asResponse: true`. Normalising
 * both outcomes to a status code keeps the assertions about behaviour rather
 * than about which mechanism Better Auth used to signal the refusal.
 */
async function signUp(
  auth: Auth,
  email: string,
  opts: { code?: string; name?: string; extra?: Record<string, unknown> } = {},
): Promise<{ status: number }> {
  try {
    const res = await auth.api.signUpEmail({
      body: {
        name: opts.name ?? "Someone",
        email,
        password: PASSWORD,
        ...opts.extra,
      } as never,
      headers: opts.code ? new Headers({ [INVITE_HEADER]: opts.code }) : undefined,
      asResponse: true,
    });
    return { status: res.status };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (typeof status === "number") return { status };
    throw error;
  }
}

/** Replay the Set-Cookie header from a sign-in as a request cookie. */
function cookiesFrom(response: Response): Headers {
  const jar = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return new Headers({ cookie: jar });
}

async function addCode(code: string, expiresAt = new Date(Date.now() + 86_400_000)) {
  await handle.db.insert(inviteCodeTable).values({ code, expiresAt });
}

beforeEach(async () => {
  handle = await createTestDatabase();
});

afterEach(() => {
  handle.cleanup();
});

describe("registration gate (through the real API)", () => {
  it("allows the first account with registration disabled, and makes it admin", async () => {
    const auth = makeAuth(false);
    const res = await signUp(auth, "first@example.test", { name: "Test User" });

    expect(res.status).toBe(200);

    const rows = await handle.db.select().from(user);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.isAdmin).toBe(true);
  });

  it("blocks a second account with no invite code", async () => {
    const auth = makeAuth(false);
    await signUp(auth, "first@example.test");

    const res = await signUp(auth, "second@example.test");

    expect(res.status).toBe(403);
    expect(await handle.db.select().from(user)).toHaveLength(1);
  });

  it("allows a second account when registration is open", async () => {
    const open = makeAuth(true);
    await signUp(open, "first@example.test");
    const res = await signUp(open, "second@example.test");

    expect(res.status).toBe(200);
    expect(await handle.db.select().from(user)).toHaveLength(2);
  });

  it("does not make the second account an admin", async () => {
    const open = makeAuth(true);
    await signUp(open, "first@example.test");
    await signUp(open, "second@example.test");

    const [second] = await handle.db
      .select()
      .from(user)
      .where(eq(user.email, "second@example.test"));

    expect(second!.isAdmin).toBe(false);
  });
});

describe("disableSignups (through the real API)", () => {
  it("still allows the first account", async () => {
    const auth = makeAuth(false, true);
    const res = await signUp(auth, "first@example.test");

    expect(res.status).toBe(200);
    expect(await handle.db.select().from(user)).toHaveLength(1);
  });

  it("blocks a second account even with open registration", async () => {
    await signUp(makeAuth(true, true), "first@example.test");

    const res = await signUp(makeAuth(true, true), "second@example.test");

    expect(res.status).toBe(403);
    expect(await handle.db.select().from(user)).toHaveLength(1);
  });

  it("blocks a second account even with a valid invite code", async () => {
    await signUp(makeAuth(false, true), "first@example.test");
    await addCode("GOOD123456");

    const res = await signUp(makeAuth(false, true), "second@example.test", {
      code: "GOOD123456",
    });

    expect(res.status).toBe(403);
    expect(await handle.db.select().from(user)).toHaveLength(1);
  });
});

describe("invite codes (through the real API)", () => {
  beforeEach(async () => {
    await signUp(makeAuth(false), "first@example.test");
  });

  it("accepts a valid code and records the redeemer", async () => {
    await addCode("GOOD123456");
    const auth = makeAuth(false);

    const res = await signUp(auth, "invited@example.test", { code: "GOOD123456" });
    expect(res.status).toBe(200);

    const [invited] = await handle.db
      .select()
      .from(user)
      .where(eq(user.email, "invited@example.test"));
    const [code] = await handle.db
      .select()
      .from(inviteCodeTable)
      .where(eq(inviteCodeTable.code, "GOOD123456"));

    expect(invited).toBeDefined();
    expect(code!.usedAt).toBeInstanceOf(Date);
    expect(code!.usedById).toBe(invited!.id);
  });

  it("rejects an unknown code", async () => {
    const res = await signUp(makeAuth(false), "x@example.test", { code: "NOSUCH1234" });
    expect(res.status).toBe(403);
  });

  it("rejects an expired code", async () => {
    await addCode("EXPIRED123", new Date(Date.now() - 1000));
    const res = await signUp(makeAuth(false), "x@example.test", { code: "EXPIRED123" });
    expect(res.status).toBe(403);
  });

  it("refuses to reuse a code", async () => {
    await addCode("ONCE123456");
    const auth = makeAuth(false);

    const first = await signUp(auth, "one@example.test", { code: "ONCE123456" });
    const second = await signUp(auth, "two@example.test", { code: "ONCE123456" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(403);
    expect(await handle.db.select().from(user)).toHaveLength(2); // bootstrap + one
  });
});

/**
 * Privilege escalation via the public sign-up endpoint. `isAdmin` is declared
 * with `input: false`, so a caller supplying it must not be believed.
 */
describe("privilege escalation", () => {
  it("ignores isAdmin supplied in the sign-up body", async () => {
    const open = makeAuth(true);
    await signUp(open, "first@example.test"); // consumes the bootstrap grant

    await signUp(open, "sneaky@example.test", {
      name: "Sneaky",
      extra: { isAdmin: true },
    });

    const [sneaky] = await handle.db
      .select()
      .from(user)
      .where(eq(user.email, "sneaky@example.test"));

    // Either the field was rejected outright or silently dropped; what matters
    // is that no admin was minted.
    expect(sneaky?.isAdmin ?? false).toBe(false);
  });
});

describe("sign-in and sessions", () => {
  beforeEach(async () => {
    await signUp(makeAuth(false), "test@example.test", { name: "Test User" });
  });

  it("issues a usable session on sign-in", async () => {
    const auth = makeAuth(false);
    const res = await auth.api.signInEmail({
      body: { email: "test@example.test", password: PASSWORD },
      asResponse: true,
    });

    expect(res.status).toBe(200);

    const session = await auth.api.getSession({ headers: cookiesFrom(res) });
    expect(session?.user.email).toBe("test@example.test");
    expect(session?.user.isAdmin).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const auth = makeAuth(false);
    const res = await auth.api.signInEmail({
      body: { email: "test@example.test", password: "not-the-password" },
      asResponse: true,
    });

    expect(res.status).not.toBe(200);
  });

  it("returns no session without a cookie", async () => {
    const session = await makeAuth(false).api.getSession({ headers: new Headers() });
    expect(session).toBeNull();
  });

  it("returns no session for a forged cookie", async () => {
    const session = await makeAuth(false).api.getSession({
      headers: new Headers({ cookie: "hmp.session_token=not-a-real-token" }),
    });
    expect(session).toBeNull();
  });

  /** The path the app actually uses — a Server Action, not an HTTP request. */
  it("revokes the session on sign-out", async () => {
    const auth = makeAuth(false);
    const res = await auth.api.signInEmail({
      body: { email: "test@example.test", password: PASSWORD },
      asResponse: true,
    });
    const jar = cookiesFrom(res);

    expect(await auth.api.getSession({ headers: jar })).not.toBeNull();

    await auth.api.signOut({ headers: jar });

    expect(await auth.api.getSession({ headers: jar })).toBeNull();
  });
});

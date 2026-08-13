import "server-only";

import { forbidden, unauthorized } from "next/navigation";
import { cache } from "react";
import { headers } from "next/headers";

import { getAuth } from "./index";

/**
 * The Data Access Layer — the real authorisation boundary.
 *
 * Next's own guidance is explicit that Proxy (formerly Middleware) must not be
 * the auth boundary: it is for optimistic redirects only. Every protected read
 * or write goes through a function in this file, as close to the data as
 * possible, so bypassing the proxy achieves nothing.
 *
 * `server-only` makes importing this from a Client Component a build error.
 * Client Components receive session data as props from a Server Component
 * parent instead.
 */

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof verifySession>>
>["user"];

/**
 * Resolve the current session, or null.
 *
 * Wrapped in React `cache()` so repeated calls within one render pass — layout,
 * page, and several leaf components — hit the database once.
 */
export const verifySession = cache(async () => {
  const auth = await getAuth();
  return auth.api.getSession({ headers: await headers() });
});

/** The signed-in user, or null. Safe to call when signed out. */
export const getCurrentUser = cache(async () => {
  return (await verifySession())?.user ?? null;
});

export const isSignedIn = cache(async () => {
  return (await verifySession()) !== null;
});

/**
 * Require a signed-in user, or interrupt with the 401 boundary.
 * Use this in every protected page, Server Action and Route Handler.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await verifySession();
  if (!session) unauthorized();
  return session.user;
}

/** Require an admin, or interrupt with the 403 boundary. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) forbidden();
  return user;
}

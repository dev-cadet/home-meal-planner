import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic routing only — NOT the auth boundary.
 *
 * Next's documentation is explicit that Proxy (the Next 16 rename of
 * Middleware) must not be used for session management or authorisation. It
 * only checks whether a session *cookie is present*; it does not validate it,
 * and a forged cookie sails straight through.
 *
 * Real enforcement lives in the Data Access Layer (`src/lib/auth/dal.ts`),
 * next to the data. This file exists purely so signed-out visitors get a tidy
 * redirect instead of hitting an interrupt boundary on every navigation.
 */

const SESSION_COOKIE = "hmp.session_token";
/**
 * Better Auth prepends this whenever `BETTER_AUTH_URL` is `https://` — which
 * is any real deployment behind a domain, dev included. Both names must be
 * checked or every request looks signed-out over https.
 */
const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`;

/** Reachable without a session. */
const PUBLIC_ROUTES = ["/sign-in", "/sign-up"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Presence only. Validity is the DAL's business.
  const hasSessionCookie =
    request.cookies.has(SESSION_COOKIE) ||
    request.cookies.has(SECURE_SESSION_COOKIE);

  if (!hasSessionCookie && !isPublic) {
    const url = new URL("/sign-in", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSessionCookie && isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  /**
   * Server Components cannot read the current pathname. The app shell needs it
   * to enforce the forced-password-change gate without redirecting the
   * change-password page to itself, so it is passed along as a header.
   */
  const forwarded = new Headers(request.headers);
  forwarded.set(PATHNAME_HEADER, pathname);

  return NextResponse.next({ request: { headers: forwarded } });
}

export const PATHNAME_HEADER = "x-pathname";

export const config = {
  /**
   * Everything except Next internals, static assets, and the auth API itself
   * — which must stay reachable while signed out in order to sign in.
   */
  matcher: [
    // api/health is excluded too: Docker's healthcheck has no session, and a
    // redirect to /sign-in would report a perfectly healthy container as sick.
    "/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

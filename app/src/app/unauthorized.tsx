import { Button } from "@/components/ui/button";
import { clearSessionAction } from "@/lib/auth/actions";

/**
 * Rendered when the DAL calls `unauthorized()` — no valid session.
 * Enabled by `experimental.authInterrupts` in next.config.ts.
 *
 * The button clears the session cookie rather than simply linking to
 * /sign-in. A stale cookie still counts as "present" to the proxy, which
 * would bounce the link straight back here — an inescapable loop. Clearing it
 * first is what actually lets someone sign in again.
 */
export default function Unauthorized() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p className="text-sm font-medium text-ink-muted">401</p>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        You need to sign in
      </h1>
      <p className="max-w-sm text-ink-muted">
        Your session has ended, or this page is only available to signed-in
        members of the household.
      </p>
      <form action={clearSessionAction} className="mt-2">
        <Button type="submit">Sign in</Button>
      </form>
    </main>
  );
}

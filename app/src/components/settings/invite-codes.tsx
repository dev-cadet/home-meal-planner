import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createInviteAction, revokeInviteAction } from "@/lib/admin/actions";
import { formatDate } from "@/lib/date";
import type { IsoDate } from "@/lib/date";

export interface InviteRow {
  code: string;
  expiresAt: Date;
  usedAt: Date | null;
  redeemer: string | null;
  /** Resolved server-side; see lib/admin/queries.ts. */
  status: "active" | "used" | "expired";
}

const asIsoDate = (d: Date): IsoDate => d.toISOString().slice(0, 10);

/**
 * Invite management. A Server Component with plain forms — no client state is
 * needed, so none is used.
 */
export function InviteCodes({
  invites,
  allowRegistration,
}: {
  invites: InviteRow[];
  allowRegistration: boolean;
}) {
  const unused = invites.filter((i) => i.status === "active");
  const spent = invites.filter((i) => i.status !== "active");

  return (
    <div className="flex flex-col gap-3">
      {allowRegistration && (
        <p className="rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-ink">
          <code className="font-mono text-xs">ALLOW_REGISTRATION</code> is on, so
          anyone can sign up without a code. Turn it off to make invites the only
          way in.
        </p>
      )}

      <form action={createInviteAction}>
        <Button type="submit" size="sm">
          <Plus className="size-4" />
          Generate invite code
        </Button>
      </form>

      {unused.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {unused.map((invite) => (
            <li
              key={invite.code}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-mono text-base font-semibold tracking-wide text-ink select-all">
                  {invite.code}
                </p>
                <p className="text-xs text-ink-muted">
                  Expires {formatDate(asIsoDate(invite.expiresAt))}
                </p>
              </div>
              <form action={revokeInviteAction.bind(null, invite.code)}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:bg-danger-soft"
                >
                  Revoke
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {unused.length === 0 && (
        <p className="text-sm text-ink-muted">
          No unused codes. Generate one to let somebody else join.
        </p>
      )}

      {spent.length > 0 && (
        <details className="rounded-2xl border border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-muted">
            Used and expired ({spent.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-muted">
            {spent.map((invite) => (
              <li key={invite.code} className="flex justify-between gap-3">
                <span className="font-mono text-xs">{invite.code}</span>
                <span className="text-xs">
                  {invite.status === "used"
                    ? `redeemed by ${invite.redeemer ?? "a deleted user"}`
                    : "expired"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

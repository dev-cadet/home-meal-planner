import Link from "next/link";

import { RouteTitle } from "@/components/shell/route-title";
import { UserMenu } from "@/components/shell/user-menu";
import { signOutAction } from "@/lib/auth/actions";

export interface TopBarProps {
  user: { name: string; email: string; isAdmin: boolean };
}

/**
 * A Server Component: it passes the Server Action down to the client menu.
 * Client Components cannot import the DAL, so session data always arrives as
 * props from a server parent (docs/plan.md §2).
 */
export function TopBar({ user }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-surface/90 px-4 backdrop-blur-sm md:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        {/*
          Home has no slot of its own in the mobile bottom bar (see
          navigation.ts) — this is how it's reached there instead, mirroring
          the sidebar's logo. Desktop already has that logo, so this is
          mobile-only.
        */}
        <Link
          href="/"
          aria-label="Home"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-on-primary md:hidden"
        >
          M
        </Link>
        <RouteTitle />
      </div>
      <UserMenu
        name={user.name}
        email={user.email}
        isAdmin={user.isAdmin}
        signOut={signOutAction}
      />
    </header>
  );
}

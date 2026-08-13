"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useFormStatus } from "react-dom";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";

/**
 * The sign-out row.
 *
 * Two things here are load-bearing, both learned from the button doing nothing
 * at all:
 *
 *  - `onSelect` is prevented. Radix closes the menu on select, which unmounts
 *    this subtree *during* the click — before the browser dispatches the form's
 *    submit default action. A detached form never submits. Measured in a real
 *    browser: zero submit events, zero POSTs, form already gone from the DOM.
 *    The menu stays open for the moment it takes the action to redirect.
 *
 *  - The menu item is the *button*, not a form wrapping one. Radix activates a
 *    keyboard-selected item by calling `.click()` on it, and clicking a `<form>`
 *    element does nothing — so with the roles the other way round, Enter and
 *    Space were dead too.
 */
function SignOutItem() {
  const { pending } = useFormStatus();

  return (
    <DropdownMenuItem asChild onSelect={(event) => event.preventDefault()}>
      <button type="submit" disabled={pending} className="w-full">
        <LogOut />
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </DropdownMenuItem>
  );
}

export interface UserMenuProps {
  name: string;
  email: string;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

/**
 * Top-bar account menu. Settings lives here rather than in the bottom bar,
 * which has no spare slot (docs/plan.md §7).
 */
export function UserMenu({ name, email, isAdmin, signOut }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-full transition-opacity hover:opacity-80"
      >
        <Avatar name={name} />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="flex flex-col">
            <span className="font-medium text-ink">
              {name}
              {isAdmin && (
                <span className="ml-2 rounded-full bg-primary-soft px-1.5 py-0.5 text-[0.6875rem] font-medium text-primary">
                  admin
                </span>
              )}
            </span>
            <span className="text-xs text-ink-muted">{email}</span>
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>

        {/* A form, not an onClick: sign-out must be a POST-like mutation. */}
        <form action={signOut}>
          <SignOutItem />
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

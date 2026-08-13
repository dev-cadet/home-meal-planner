"use client";

import { KeyRound, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { AdminState } from "@/lib/admin/actions";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  mustChangePassword: boolean;
}

export function AdminUsers({
  users,
  currentUserId,
  resetPassword,
  deleteUser,
  setAdmin,
  passwordChangesDisabled = false,
}: {
  users: AdminUser[];
  currentUserId: string;
  resetPassword: (userId: string) => Promise<AdminState>;
  deleteUser: (userId: string) => Promise<AdminState>;
  setAdmin: (userId: string, makeAdmin: boolean) => Promise<AdminState>;
  passwordChangesDisabled?: boolean;
}) {
  const [state, setState] = useState<AdminState>({});
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<AdminState>) =>
    startTransition(async () => {
      setState(await fn());
      setOpenFor(null);
    });

  return (
    <div className="flex flex-col gap-3">
      {state.error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      {state.notice && (
        <div className="rounded-xl border border-primary/40 bg-primary-soft px-3 py-2.5 text-sm text-primary">
          <p>{state.notice}</p>
          {state.secret && (
            <>
              <p className="mt-2 font-mono text-base font-semibold tracking-wide text-ink select-all">
                {state.secret}
              </p>
              {/* Only ever rendered once — it is not stored anywhere in plain text. */}
              <p className="mt-1 text-xs">
                Copy it now. It will not be shown again.
              </p>
            </>
          )}
        </div>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 p-3">
            <Avatar name={u.name} />

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate font-medium text-ink">
                {u.name}
                {u.isAdmin && (
                  <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[0.6875rem] font-medium text-primary">
                    admin
                  </span>
                )}
                {u.id === currentUserId && (
                  <span className="text-xs font-normal text-ink-faint">you</span>
                )}
              </p>
              <p className="truncate text-sm text-ink-muted">{u.email}</p>
              {u.mustChangePassword && (
                <p className="text-xs text-accent">Must change password</p>
              )}
            </div>

            <div className="flex w-full justify-end gap-1 sm:w-auto">
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(() => setAdmin(u.id, !u.isAdmin))}
              >
                {u.isAdmin ? (
                  <ShieldOff className="size-4" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                <span className="sr-only sm:not-sr-only">
                  {u.isAdmin ? "Demote" : "Promote"}
                </span>
              </Button>

              {!passwordChangesDisabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => resetPassword(u.id))}
                >
                  <KeyRound className="size-4" />
                  <span className="sr-only sm:not-sr-only">Reset</span>
                </Button>
              )}

              <Sheet
                open={openFor === u.id}
                onOpenChange={(open) => setOpenFor(open ? u.id : null)}
              >
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending || u.id === currentUserId}
                    className="text-danger hover:bg-danger-soft"
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Delete {u.name}</span>
                  </Button>
                </SheetTrigger>

                <SheetContent
                  title={`Remove ${u.name}?`}
                  description="Their account is deleted; their content is not."
                >
                  <p className="mb-4 text-sm text-ink-muted">
                    Meals, plans and schedule entries they created all stay, and
                    will simply show “a deleted user” as the author.
                  </p>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={() => setOpenFor(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      disabled={pending}
                      onClick={() => run(() => deleteUser(u.id))}
                    >
                      Remove account
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

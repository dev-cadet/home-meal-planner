"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { changePasswordAction } from "@/lib/settings/actions";

export function PasswordForm({ forced = false }: { forced?: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <Field
        label={forced ? "Temporary password" : "Current password"}
        htmlFor="current-password"
        hint={forced ? "The one an admin gave you." : undefined}
      >
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
        />
      </Field>

      <Field
        label="New password"
        htmlFor="new-password"
        hint="At least 10 characters."
      >
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirm-password">
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <p className="text-xs text-ink-muted">
        Changing your password signs you out everywhere else.
      </p>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}

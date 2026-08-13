"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { updateProfileAction } from "@/lib/settings/actions";

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Name" htmlFor="profile-name" error={state.error}>
        <Input id="profile-name" name="name" defaultValue={name} required />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.notice && (
          <p role="status" className="text-sm text-primary">
            {state.notice}
          </p>
        )}
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createBlankShoppingListAction } from "@/lib/shopping-lists/actions";

export function BlankShoppingListForm() {
  const [state, formAction, pending] = useActionState(createBlankShoppingListAction, {});
  const formId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <Field label="Name" htmlFor={`${formId}-name`} error={state.fieldErrors?.name?.[0]}>
        <Input
          id={`${formId}-name`}
          name="name"
          placeholder="Costco run"
          required
          autoFocus
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create list"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/shopping-lists">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

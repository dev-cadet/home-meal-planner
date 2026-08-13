"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { PlanFormState } from "@/lib/plans/actions";

export function PlanForm({
  action,
  values,
  submitLabel,
}: {
  action: (state: PlanFormState, formData: FormData) => Promise<PlanFormState>;
  values: { id?: string; name: string; description: string };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formId = useId();
  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0];

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

      <Field label="Name" htmlFor={`${formId}-name`} error={fieldError("name")}>
        <Input
          id={`${formId}-name`}
          name="name"
          defaultValue={values.name}
          placeholder="Weeknight favourites"
          required
          autoFocus={!values.id}
        />
      </Field>

      <Field
        label="Description"
        htmlFor={`${formId}-description`}
        hint="Optional. What this grouping is for."
        error={fieldError("description")}
      >
        <Textarea
          id={`${formId}-description`}
          name="description"
          defaultValue={values.description}
          placeholder="Nothing here takes more than half an hour of actual work."
          className="min-h-20"
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button asChild variant="ghost">
          <Link href={values.id ? `/plans/${values.id}` : "/plans"}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

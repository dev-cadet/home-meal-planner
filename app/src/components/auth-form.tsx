"use client";

import { useActionState } from "react";

import type { AuthFormState } from "@/lib/auth/actions";

type Action = (
  state: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

export interface Field {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

interface AuthFormProps {
  action: Action;
  fields: Field[];
  submitLabel: string;
  hidden?: Record<string, string>;
  footer: React.ReactNode;
}

export function AuthForm({
  action,
  fields,
  submitLabel,
  hidden,
  footer,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {hidden &&
        Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {state.error}
        </p>
      )}

      {fields.map((field) => {
        const fieldError = state.fieldErrors?.[field.name];
        const errorId = `${field.name}-error`;

        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label
              htmlFor={field.name}
              className="text-sm font-medium text-stone-700 dark:text-stone-300"
            >
              {field.label}
              {field.required === false && (
                <span className="ml-1 font-normal text-stone-500">optional</span>
              )}
            </label>

            <input
              id={field.name}
              name={field.name}
              type={field.type ?? "text"}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              required={field.required !== false}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? errorId : undefined}
              className="h-11 rounded-lg border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/25 aria-[invalid]:border-red-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            />

            {field.hint && !fieldError && (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {field.hint}
              </p>
            )}
            {fieldError && (
              <p id={errorId} className="text-xs text-red-700 dark:text-red-300">
                {fieldError}
              </p>
            )}
          </div>
        );
      })}

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-lg bg-emerald-700 px-4 text-base font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>

      <p className="text-center text-sm text-stone-600 dark:text-stone-400">
        {footer}
      </p>
    </form>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm, type Field } from "@/components/auth-form";
import { signUpAction } from "@/lib/auth/actions";
import { registrationMode } from "@/lib/auth/registration";
import { config } from "@/lib/config";
import { getDb } from "@/lib/db/client";

export const metadata: Metadata = { title: "Sign up · Home Meal Planner" };

/**
 * Which registration rule applies depends on live database state (whether any
 * user exists yet). Prerendering would freeze that answer at build time and
 * show the wrong form — an invite field on a fresh deployment, or none once
 * the household is registered.
 */
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const mode = await registrationMode(
    await getDb(),
    config.ALLOW_REGISTRATION,
    config.DISABLE_SIGNUPS,
  );

  const footer = (
    <>
      Already have an account?{" "}
      <Link
        href="/sign-in"
        className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
      >
        Sign in
      </Link>
    </>
  );

  const fields: Field[] = [
    { name: "name", label: "Name", autoComplete: "name", placeholder: "Pappa Bear" },
    {
      name: "email",
      label: "Email",
      type: "email",
      autoComplete: "email",
      placeholder: "you@example.com",
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      autoComplete: "new-password",
      hint: "At least 10 characters.",
    },
  ];

  // Only asked for when it is actually required.
  if (mode === "invite") {
    fields.push({
      name: "inviteCode",
      label: "Invite code",
      autoComplete: "off",
      placeholder: "ABCD234XYZ",
      hint: "Ask an admin for a code.",
    });
  }

  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Create an account
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          {mode === "bootstrap"
            ? "This is the first account, so it will be the administrator."
            : mode === "disabled"
              ? "Sign-up is disabled on this instance."
              : mode === "invite"
                ? "Sign-up is invite only."
                : "Anyone can sign up right now."}
        </p>
      </header>

      {mode === "disabled" ? (
        <p className="text-center text-sm text-stone-600 dark:text-stone-400">
          {footer}
        </p>
      ) : (
        <AuthForm
          action={signUpAction}
          submitLabel="Create account"
          fields={fields}
          footer={footer}
        />
      )}
    </>
  );
}

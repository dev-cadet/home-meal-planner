import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { signInAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Sign in · Home Meal Planner" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  const redirectTo = typeof next === "string" ? next : undefined;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Welcome back.
        </p>
      </header>

      <AuthForm
        action={signInAction}
        submitLabel="Sign in"
        hidden={redirectTo ? { next: redirectTo } : undefined}
        fields={[
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
            autoComplete: "current-password",
          },
        ]}
        footer={
          <>
            Need an account?{" "}
            <Link
              href="/sign-up"
              className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
            >
              Sign up
            </Link>
          </>
        }
      />
    </>
  );
}

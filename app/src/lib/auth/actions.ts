"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuth, INVITE_HEADER } from "./index";

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters."),
  inviteCode: z.string().trim().optional(),
});

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Better Auth signals refusals as thrown APIErrors carrying a message. */
function messageFrom(error: unknown, fallback: string): string {
  const body = (error as { body?: { message?: string } }).body;
  return body?.message ?? fallback;
}

/** Only ever follow same-origin relative paths, never an absolute URL. */
function nextPathOf(formData: FormData): string {
  const next = formData.get("next");
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/";
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  try {
    const auth = await getAuth();
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch {
    // Deliberately not distinguishing "unknown email" from "wrong password" —
    // that difference tells an attacker which addresses have accounts here.
    return { error: "Incorrect email or password." };
  }

  // Outside the try: redirect() signals by throwing.
  redirect(nextPathOf(formData));
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    inviteCode: formData.get("inviteCode") ?? undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { name, email, password, inviteCode } = parsed.data;
  const requestHeaders = new Headers(await headers());
  if (inviteCode) requestHeaders.set(INVITE_HEADER, inviteCode);

  try {
    const auth = await getAuth();
    await auth.api.signUpEmail({
      body: { name, email, password },
      headers: requestHeaders,
    });
  } catch (error) {
    return { error: messageFrom(error, "Could not create your account.") };
  }

  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const auth = await getAuth();
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}

/**
 * Drop the session cookie and return to sign-in, valid session or not.
 *
 * This exists because of a genuine dead end. The proxy only checks whether a
 * session cookie is *present*, so a holder of a revoked cookie — exactly what
 * an admin password reset produces — gets bounced off /sign-in back to /,
 * where the DAL rejects them with 401. The 401 page's link to /sign-in bounces
 * again: a loop with no way back in.
 *
 * `auth.api.signOut` cannot be relied on here, since it needs a session that
 * by definition no longer exists. Deleting the cookie directly always works.
 */
export async function clearSessionAction(): Promise<void> {
  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (cookie.name.startsWith("hmp.")) jar.delete(cookie.name);
  }
  redirect("/sign-in");
}

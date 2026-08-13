"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuth } from "../auth";
import { requireUser } from "../auth/dal";
import { config } from "../config";
import { getDb } from "../db/client";
import { user } from "../db/schema";
import { FESTIVE_ENABLED_COOKIE, FESTIVE_OPT_OUT_COOKIE, PALETTE_COOKIE } from "../theme/cookies";
import {
  isFestivePaletteId,
  isStandardPaletteId,
} from "../theme/palettes";

const YEAR = 60 * 60 * 24 * 365;
const cookieOptions = { path: "/", maxAge: YEAR, sameSite: "lax" as const, httpOnly: false };

export interface SettingsState {
  error?: string;
  notice?: string;
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Your name cannot be empty.").max(80),
});

export async function updateProfileAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const current = await requireUser();

  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]!.message };
  }

  const db = await getDb();
  await db.update(user).set({ name: parsed.data.name }).where(eq(user.id, current.id));

  revalidatePath("/settings");
  return { notice: "Name updated." };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(10, "Use at least 10 characters."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Those passwords do not match.",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const current = await requireUser();

  // A forced change (`mustChangePassword`) is still let through even when
  // disabled — otherwise a temporary password issued before the flag was
  // set would lock that account out permanently. Ordinary self-service
  // changes are what a public demo actually wants to block.
  if (config.DISABLE_PASSWORD_CHANGES && current.mustChangePassword !== true) {
    return { error: "Password changes are disabled on this instance." };
  }

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]!.message };
  }

  try {
    const auth = await getAuth();
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        // Keep this session alive; other devices are revoked below.
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch {
    return { error: "That current password is not right." };
  }

  // Clearing the flag is what releases the forced-change gate.
  const db = await getDb();
  await db
    .update(user)
    .set({ mustChangePassword: false })
    .where(eq(user.id, current.id));

  revalidatePath("/", "layout");
  redirect("/settings?changed=1");
}

export async function setPaletteAction(paletteId: string): Promise<void> {
  await requireUser();
  if (!isStandardPaletteId(paletteId)) return;

  const jar = await cookies();
  jar.set(PALETTE_COOKIE, paletteId, cookieOptions);

  revalidatePath("/", "layout");
}

export async function setFestiveEnabledAction(enabled: boolean): Promise<void> {
  await requireUser();

  const jar = await cookies();
  jar.set(FESTIVE_ENABLED_COOKIE, String(enabled), cookieOptions);

  revalidatePath("/", "layout");
}

export async function setFestiveOptOutAction(disabledIds: string[]): Promise<void> {
  await requireUser();
  if (!disabledIds.every(isFestivePaletteId)) return;

  const jar = await cookies();
  jar.set(FESTIVE_OPT_OUT_COOKIE, disabledIds.join(","), cookieOptions);

  revalidatePath("/", "layout");
}

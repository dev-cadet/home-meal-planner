import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PasswordForm } from "@/components/settings/password-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/states";
import { requireUser } from "@/lib/auth/dal";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Change password · Settings" };

export default async function ChangePasswordPage() {
  const user = await requireUser();
  const forced = user.mustChangePassword === true;

  // The forced-change escape valve still needs this page; an ordinary visit
  // does not, so send it back rather than showing a form that will just
  // reject the submission.
  if (config.DISABLE_PASSWORD_CHANGES && !forced) {
    redirect("/settings");
  }

  return (
    <>
      <PageHeader
        title={forced ? "Choose a new password" : "Change password"}
        description={
          forced
            ? "An admin gave you a temporary password. Pick your own before carrying on."
            : undefined
        }
        actions={
          // No way back out while a forced change is outstanding.
          forced ? null : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings">
                <ArrowLeft className="size-4" />
                Settings
              </Link>
            </Button>
          )
        }
      />

      <div className="max-w-md">
        <PasswordForm forced={forced} />
      </div>
    </>
  );
}

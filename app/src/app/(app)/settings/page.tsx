import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { AdminUsers } from "@/components/settings/admin-users";
import { FestiveSettings } from "@/components/settings/festive-settings";
import { InviteCodes } from "@/components/settings/invite-codes";
import { PalettePicker } from "@/components/settings/palette-picker";
import { ProfileForm } from "@/components/settings/profile-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/states";
import {
  deleteUserAction,
  resetUserPasswordAction,
  setAdminAction,
} from "@/lib/admin/actions";
import { listInviteCodes, listUsers } from "@/lib/admin/queries";
import { requireUser } from "@/lib/auth/dal";
import { config } from "@/lib/config";
import { FESTIVE_ENABLED_COOKIE, FESTIVE_OPT_OUT_COOKIE, PALETTE_COOKIE } from "@/lib/theme/cookies";
import { enabledFestiveHolidayIds } from "@/lib/theme/festive";
import { DEFAULT_STANDARD_PALETTE_ID, FESTIVE_PALETTES, isStandardPaletteId } from "@/lib/theme/palettes";

export const metadata: Metadata = { title: "Settings · Home Meal Planner" };

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium text-ink">{title}</h3>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

export default async function SettingsPage({
  searchParams,
}: PageProps<"/settings">) {
  const user = await requireUser();
  const params = await searchParams;

  const jar = await cookies();
  const storedPalette = jar.get(PALETTE_COOKIE)?.value;
  const paletteId = storedPalette && isStandardPaletteId(storedPalette)
    ? storedPalette
    : DEFAULT_STANDARD_PALETTE_ID;

  const festiveEnabled = jar.get(FESTIVE_ENABLED_COOKIE)?.value === "true";
  const enabledHolidayIds = enabledFestiveHolidayIds(jar.get(FESTIVE_OPT_OUT_COOKIE)?.value);
  const disabledHolidayIds = FESTIVE_PALETTES.map((h) => h.id).filter(
    (id) => !enabledHolidayIds.has(id),
  );

  const isAdmin = user.isAdmin === true;
  // Both are admin-gated; only fetch them for an admin.
  const users = isAdmin ? await listUsers() : [];
  const invites = isAdmin ? await listInviteCodes() : [];

  return (
    <>
      <PageHeader title="Settings" />

      {params.changed === "1" && (
        <p
          role="status"
          className="mb-5 rounded-xl border border-primary/40 bg-primary-soft px-3 py-2 text-sm text-primary"
        >
          Your password was changed.
        </p>
      )}

      <div className="flex flex-col gap-8">
        <Section title="Profile">
          <ProfileForm name={user.name} />
          <p className="text-sm text-ink-muted">
            Signed in as <span className="text-ink">{user.email}</span>.
          </p>
        </Section>

        <Section title="Password">
          {config.DISABLE_PASSWORD_CHANGES ? (
            <p className="text-sm text-ink-muted">
              Password changes are disabled on this instance.
            </p>
          ) : (
            <Button asChild variant="secondary" size="sm" className="self-start">
              <Link href="/settings/password">
                <KeyRound className="size-4" />
                Change password
              </Link>
            </Button>
          )}
        </Section>

        <Section title="Appearance">
          <PalettePicker current={paletteId} />
        </Section>

        <Section
          title="Festive theming"
          description="Automatically swap in a themed palette during a holiday's month."
        >
          <FestiveSettings enabled={festiveEnabled} disabledIds={disabledHolidayIds} />
        </Section>

        {isAdmin && (
          <>
            <Section
              title="Household"
              description="Everyone with an account can see and edit all meals, plans and the schedule."
            >
              <AdminUsers
                users={users.map((u) => ({
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  isAdmin: u.isAdmin,
                  mustChangePassword: u.mustChangePassword,
                }))}
                currentUserId={user.id}
                resetPassword={resetUserPasswordAction}
                deleteUser={deleteUserAction}
                setAdmin={setAdminAction}
                passwordChangesDisabled={config.DISABLE_PASSWORD_CHANGES}
              />
            </Section>

            <Section
              title="Invite codes"
              description="Single use, and they expire."
            >
              {config.DISABLE_SIGNUPS ? (
                <p className="text-sm text-ink-muted">
                  <code className="font-mono text-xs">DISABLE_SIGNUPS</code> is
                  on, so sign-up is closed entirely — invite codes would not
                  be usable.
                </p>
              ) : (
                <InviteCodes
                  invites={invites}
                  allowRegistration={config.ALLOW_REGISTRATION}
                />
              )}
            </Section>
          </>
        )}

        <Section
          title="Deployment"
          description="Set by environment variables; restart to change."
        >
          <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            <Row label="Time zone" value={config.TZ} />
            <Row label="Date format" value={config.DATE_FORMAT} />
            <Row label="Units" value={config.MEASUREMENT_SYSTEM} />
            <Row label="Week starts" value={config.WEEK_STARTS_ON} />
            <Row
              label="Registration"
              value={
                config.DISABLE_SIGNUPS
                  ? "disabled"
                  : config.ALLOW_REGISTRATION
                    ? "open"
                    : "invite only"
              }
            />
            <Row
              label="Invite validity"
              value={`${config.INVITE_CODE_TTL_DAYS} days`}
            />
            <Row
              label="Password changes"
              value={config.DISABLE_PASSWORD_CHANGES ? "disabled" : "allowed"}
            />
            <Row
              label="Seed on start"
              value={config.SEED_ON_START ? "on" : "off"}
            />
          </dl>
        </Section>
      </div>
    </>
  );
}

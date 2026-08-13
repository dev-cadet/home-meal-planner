import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BottomBar } from "@/components/shell/bottom-bar";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { requireUser } from "@/lib/auth/dal";
import { PATHNAME_HEADER } from "@/proxy";

/**
 * The signed-in shell.
 *
 * `requireUser()` here supplies the top bar with a name and avatar — it is
 * *not* what protects the child routes. Layouts do not re-render on every
 * navigation, so Next's own guidance is that the auth check belongs in the
 * DAL, invoked by each page. Every page below therefore calls `requireUser()`
 * itself; React `cache()` collapses those to one lookup per request.
 */
/** Reachable while a forced password change is outstanding. */
const CHANGE_PASSWORD_PATH = "/settings/password";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  /**
   * A temporary password set by an admin is known to someone else, so it must
   * not stay in use. Everything is blocked until it is changed.
   *
   * The pathname arrives as a header from `proxy.ts` — Server Components have
   * no other way to read it — and is needed here purely so the
   * change-password page does not redirect to itself.
   */
  if (user.mustChangePassword) {
    const pathname = (await headers()).get(PATHNAME_HEADER) ?? "";
    if (!pathname.startsWith(CHANGE_PASSWORD_PATH)) {
      redirect(CHANGE_PASSWORD_PATH);
    }
  }

  return (
    <div className="flex min-h-dvh flex-1">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          Better Auth types additional fields as optional, so isAdmin arrives
          as boolean | null | undefined. Narrowed once here rather than
          defended against in every consumer.
        */}
        <TopBar
          user={{
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin === true,
          }}
        />

        {/* pb-24 clears the fixed mobile bottom bar; desktop has none. */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:px-6 md:pb-10">
          {children}
        </main>
      </div>

      <BottomBar />
    </div>
  );
}

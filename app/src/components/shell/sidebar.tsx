"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CreateSheet } from "@/components/shell/create-sheet";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS } from "@/lib/navigation";

/** Desktop navigation. The bottom bar is mobile-only; these never coexist. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface px-4 py-5 md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-on-primary">
          M
        </span>
        <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">
          Meal Planner
        </span>
      </Link>

      <CreateSheet trigger="sidebar" />

      <nav aria-label="Primary">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, sidebarLabel, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium transition-colors",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.3 : 1.8} />
                  {sidebarLabel ?? label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

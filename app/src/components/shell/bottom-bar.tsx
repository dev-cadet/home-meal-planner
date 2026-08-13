"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CreateSheet } from "@/components/shell/create-sheet";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS } from "@/lib/navigation";

/**
 * Mobile navigation, Facebook-style: four destinations plus a create button
 * in the final slot.
 *
 * `safe-bottom` adds the iOS home-indicator inset so the bar is not sitting
 * underneath it. Every target is at least 44px.
 */
export function BottomBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.6875rem] font-medium transition-colors",
                  active ? "text-primary" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon className="size-[1.375rem]" strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <CreateSheet trigger="bar" />
        </li>
      </ul>
    </nav>
  );
}

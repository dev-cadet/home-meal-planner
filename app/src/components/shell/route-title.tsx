"use client";

import { usePathname } from "next/navigation";

import { isActive, NAV_ITEMS } from "@/lib/navigation";

const EXTRA: Record<string, string> = { "/settings": "Settings" };

/** The current destination's name, for the top bar. */
export function RouteTitle() {
  const pathname = usePathname();

  const match =
    NAV_ITEMS.find((item) => isActive(pathname, item.href))?.label ??
    Object.entries(EXTRA).find(([href]) => pathname.startsWith(href))?.[1] ??
    "Meal Planner";

  return (
    <span className="truncate text-base font-semibold tracking-tight text-ink">
      {match}
    </span>
  );
}

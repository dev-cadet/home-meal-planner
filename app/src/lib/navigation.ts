import {
  CalendarDays,
  CookingPot,
  ListMusic,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: "/meals" | "/plans" | "/schedule" | "/shopping-lists";
  label: string;
  /** Longer form shown in the desktop sidebar, where width isn't tight. Falls back to `label`. */
  sidebarLabel?: string;
  icon: LucideIcon;
}

/**
 * The four primary destinations, shared by the desktop sidebar and the mobile
 * bottom bar so the two can never drift apart.
 *
 * Home is deliberately absent: it's reached via the brand mark instead (the
 * sidebar's logo on desktop, a matching mark in the top bar on mobile — see
 * `components/shell/top-bar.tsx`), which freed its slot for Shopping Lists.
 *
 * Settings is also absent: the bottom bar has five slots and the fifth
 * belongs to the create button. Settings is low-frequency and lives in the
 * top-bar avatar menu instead (docs/plan.md §7).
 *
 * "Lists" rather than "Shopping Lists" here — every other label is one short
 * word, sized for a ~75px bottom-bar column. The page itself is still titled
 * "Shopping Lists" in full.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/meals", label: "Meals", icon: CookingPot },
  { href: "/plans", label: "Plans", icon: ListMusic },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  {
    href: "/shopping-lists",
    label: "Lists",
    sidebarLabel: "Shopping Lists",
    icon: ShoppingBasket,
  },
];

/** Exact match for "/", prefix match for the rest. */
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

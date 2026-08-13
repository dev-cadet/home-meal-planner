"use client";

import {
  CalendarPlus,
  ClipboardList,
  CookingPot,
  ListMusic,
  Plus,
  ShoppingBasket,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";

const OPTIONS = [
  {
    href: "/meals/new",
    icon: CookingPot,
    label: "New meal",
    description: "Add a recipe with ingredients",
  },
  {
    href: "/plans/new",
    icon: ListMusic,
    label: "New plan",
    description: "Group meals into a playlist",
  },
  {
    href: "/schedule",
    icon: CalendarPlus,
    label: "Schedule a meal",
    description: "Put a meal on the calendar",
  },
  {
    href: "/schedule/shopping-list",
    icon: ShoppingBasket,
    label: "Shopping list",
    description: "Generate one from the schedule",
  },
  {
    href: "/shopping-lists/new",
    icon: ClipboardList,
    label: "Blank list",
    description: "Start one from scratch, not tied to a recipe",
  },
] as const;

/**
 * The create affordance: a bottom sheet on mobile, a centred dialog on
 * desktop. Rendered as the fifth slot of the bottom bar and as a button in
 * the desktop sidebar, so `trigger` decides which shape it takes.
 */
export function CreateSheet({ trigger }: { trigger: "bar" | "sidebar" }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Create"
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors",
          trigger === "bar"
            ? "min-h-[3.5rem] w-full flex-col gap-1 px-1 py-2 text-[0.6875rem] text-ink-muted hover:text-ink"
            : "h-11 w-full gap-2 rounded-xl bg-primary px-4 text-on-primary hover:bg-primary-hover",
        )}
      >
        <Plus className={trigger === "bar" ? "size-[1.375rem]" : "size-5"} strokeWidth={1.8} />
        <span>Create</span>
      </SheetTrigger>

      {/* "do", not "add" — a shopping list is generated, not created. */}
      <SheetContent title="Create" description="What would you like to do?">
        <ul className="flex flex-col gap-1">
          {OPTIONS.map(({ href, icon: Icon, label, description }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3.5 rounded-xl px-3 py-3 transition-colors hover:bg-surface-muted"
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="font-medium text-ink">{label}</span>
                  <span className="text-sm text-ink-muted">{description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

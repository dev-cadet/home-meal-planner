import { Cookie, Croissant, Sandwich, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import type { MealSlot } from "@/lib/db/schema";
import { SLOT_LABELS } from "@/lib/schedule/queries";

const ICONS: Record<MealSlot, LucideIcon> = {
  breakfast: Croissant,
  lunch: Sandwich,
  dinner: UtensilsCrossed,
  snack: Cookie,
};

/**
 * A meal slot rendered as an icon.
 *
 * The icon carries meaning rather than decoration, so it ships with a visually
 * hidden label — otherwise a screen reader announces a row as "Spaghetti
 * bolognese +" with the slots silently dropped. `sr-only` is absolutely
 * positioned, so it costs no layout.
 */
export function SlotIcon({
  slot,
  className,
}: {
  slot: MealSlot;
  className?: string;
}) {
  const Icon = ICONS[slot];

  return (
    <>
      <Icon aria-hidden className={cn("size-4 shrink-0", className)} />
      <span className="sr-only">{SLOT_LABELS[slot]}</span>
    </>
  );
}

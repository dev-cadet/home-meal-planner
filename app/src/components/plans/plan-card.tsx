import { CookingPot, Pin, Tag } from "lucide-react";
import Link from "next/link";

import { PlanCover } from "@/components/plans/plan-cover";
import { cn } from "@/lib/cn";
import { togglePinPlanAction } from "@/lib/plans/actions";
import type { PlanListItem } from "@/lib/plans/queries";

export function PlanCard({ plan }: { plan: PlanListItem }) {
  return (
    // The pin button is a sibling of the Link, not a descendant — a <button>
    // can't nest inside an <a>, so it's overlaid via this relative wrapper
    // instead (same fix as the shopping-list index row).
    <div className="relative">
      <form
        action={togglePinPlanAction.bind(null, plan.id, !plan.pinned)}
        className="absolute top-2 right-2 z-10"
      >
        <button
          type="submit"
          aria-label={plan.pinned ? "Unpin" : "Pin"}
          className={cn(
            "inline-flex size-8 cursor-pointer items-center justify-center rounded-full backdrop-blur-sm transition-colors",
            plan.pinned
              ? "bg-primary text-on-primary"
              : "bg-surface/80 text-ink-faint hover:text-ink",
          )}
        >
          <Pin className={cn("size-3.5", plan.pinned && "fill-current")} />
        </button>
      </form>

      <Link
        href={`/plans/${plan.id}`}
        // Mobile: a horizontal row, cover on the left, sized to whatever the
        // text column needs (align-items: stretch) — no forced ratio. From
        // sm: up, back to the original stacked card with a fixed 4:3 top
        // cover. See PlanCover for why the tiles are absolutely positioned —
        // that's what makes stretch-without-a-forced-ratio actually work.
        className="group flex overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong sm:flex-col"
      >
        <div className="w-1/3 shrink-0 sm:aspect-[4/3] sm:w-full">
          <PlanCover images={plan.coverImages} name={plan.name} className="h-full w-full" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5">
          <h3 className="font-medium text-ink group-hover:text-primary">
            {plan.name}
          </h3>

          {plan.description && (
            <p className="line-clamp-2 text-sm text-ink-muted">
              {plan.description}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
              <CookingPot className="size-3.5" />
              {plan.mealCount} meal{plan.mealCount === 1 ? "" : "s"}
            </div>

            {plan.tags.length > 0 && (
              <div className="flex min-w-0 items-center gap-1 text-xs text-ink-muted">
                <Tag className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{plan.tags.join(", ")}</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

import { ChevronDown, ChevronUp, Clock, X } from "lucide-react";
import Link from "next/link";

import { MealImage } from "@/components/meals/meal-image";
import {
  moveMealInPlanAction,
  removeMealFromPlanAction,
} from "@/lib/plans/actions";

export interface PlanMeal {
  id: string;
  name: string;
  servings: number | null;
  prepMins: number | null;
  cookMins: number | null;
  imageHash: string | null;
}

/**
 * The ordered contents of a plan.
 *
 * Reordering uses explicit up/down controls rather than drag-and-drop. HTML5
 * drag events do not fire on touch devices, and this app is mobile-first — so
 * dragging would need a pointer-event library and would still be the fiddlier
 * interaction on a phone. Buttons are keyboard- and screen-reader-accessible,
 * work identically everywhere, and need no client JavaScript at all: each one
 * is a form posting a Server Action.
 */
export function PlanMeals({
  planId,
  meals,
}: {
  planId: string;
  meals: PlanMeal[];
}) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {meals.map((meal, index) => {
        const minutes = (meal.prepMins ?? 0) + (meal.cookMins ?? 0);

        return (
          /*
           * Wraps on narrow screens. Three 44px controls plus the thumbnail
           * left the name about 90px at 375px — "Chicken fajitas" and
           * "Chicken curry" both rendered as "Chicken…". Shrinking the buttons
           * would break the touch-target minimum, so the controls take their
           * own line instead and the name gets the full width.
           */
          <li key={meal.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
            <span className="w-5 shrink-0 text-center text-sm font-medium text-ink-faint tabular-nums">
              {index + 1}
            </span>

            <MealImage
              mealId={meal.id}
              imageHash={meal.imageHash}
              name={meal.name}
              size="thumb"
              className="size-12 shrink-0 rounded-lg"
            />

            <div className="min-w-0 flex-1">
              <Link
                href={`/meals/${meal.id}`}
                className="block font-medium text-ink hover:text-primary"
              >
                {meal.name}
              </Link>
              <div className="flex flex-wrap items-center gap-x-3 text-xs text-ink-muted">
                {minutes > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {minutes} min
                  </span>
                )}
                {meal.servings && <span>Serves {meal.servings}</span>}
              </div>
            </div>

            <div className="flex w-full shrink-0 items-center justify-end sm:w-auto">
              <form action={moveMealInPlanAction.bind(null, planId, meal.id, "up")}>
                <button
                  type="submit"
                  aria-label={`Move ${meal.name} up`}
                  disabled={index === 0}
                  className="inline-flex size-11 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink disabled:pointer-events-none disabled:opacity-25"
                >
                  <ChevronUp className="size-5" />
                </button>
              </form>

              <form action={moveMealInPlanAction.bind(null, planId, meal.id, "down")}>
                <button
                  type="submit"
                  aria-label={`Move ${meal.name} down`}
                  disabled={index === meals.length - 1}
                  className="inline-flex size-11 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink disabled:pointer-events-none disabled:opacity-25"
                >
                  <ChevronDown className="size-5" />
                </button>
              </form>

              <form action={removeMealFromPlanAction.bind(null, planId, meal.id)}>
                <button
                  type="submit"
                  aria-label={`Remove ${meal.name} from plan`}
                  className="inline-flex size-11 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <X className="size-4" />
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

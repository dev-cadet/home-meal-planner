import { Clock, Pin, Tag, Users } from "lucide-react";
import Link from "next/link";

import { MealImage } from "@/components/meals/meal-image";
import { cn } from "@/lib/cn";
import { togglePinMealAction } from "@/lib/meals/actions";
import type { MealListItem } from "@/lib/meals/queries";

function totalMinutes(meal: MealListItem): number | null {
  const total = (meal.prepMins ?? 0) + (meal.cookMins ?? 0);
  return total > 0 ? total : null;
}

export function MealCard({ meal }: { meal: MealListItem }) {
  const minutes = totalMinutes(meal);

  return (
    // The pin button is a sibling of the Link, not a descendant — a <button>
    // can't nest inside an <a>, so it's overlaid via this relative wrapper
    // instead (same fix as the shopping-list index row).
    <div className="relative">
      <form
        action={togglePinMealAction.bind(null, meal.id, !meal.pinned)}
        className="absolute top-2 right-2 z-10"
      >
        <button
          type="submit"
          aria-label={meal.pinned ? "Unpin" : "Pin"}
          className={cn(
            "inline-flex size-8 cursor-pointer items-center justify-center rounded-full backdrop-blur-sm transition-colors",
            meal.pinned
              ? "bg-primary text-on-primary"
              : "bg-surface/80 text-ink-faint hover:text-ink",
          )}
        >
          <Pin className={cn("size-3.5", meal.pinned && "fill-current")} />
        </button>
      </form>

      <Link
        href={`/meals/${meal.id}`}
        // Mobile: a horizontal row, image on the left, sized to whatever the
        // text column needs (align-items: stretch) — no forced ratio. From
        // sm: up, back to the original stacked card with a fixed 4:3 top image.
        //
        // The image is `absolute inset-0` inside a `relative` box rather than
        // a plain h-full/w-full child: thumbnails are exactly square, and an
        // in-flow image with no imposed height falls back to its own intrinsic
        // ratio — as wide as the column, and therefore just as tall — which
        // can independently force the row taller than the text needs. Taking
        // it out of flow removes that vote entirely; it just fills whatever
        // box flex distribution (driven by the text side) settles on.
        className="group flex overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong sm:flex-col"
      >
        <div className="relative w-1/3 shrink-0 sm:aspect-[4/3] sm:w-full">
          <MealImage
            mealId={meal.id}
            imageHash={meal.imageHash}
            name={meal.name}
            size="thumb"
            className="absolute inset-0 h-full w-full"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5">
          <h3 className="font-medium text-ink group-hover:text-primary">
            {meal.name}
          </h3>

          <div className="flex flex-col gap-1">
            <div className="flex flex-col items-start gap-1 text-xs text-ink-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
              {minutes && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {minutes} min
                </span>
              )}
              {meal.servings && (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" />
                  Serves {meal.servings}
                </span>
              )}
              <span>
                {meal.ingredientCount} ingredient
                {meal.ingredientCount === 1 ? "" : "s"}
              </span>
            </div>

            {meal.tags.length > 0 && (
              <div className="flex min-w-0 items-center gap-1 text-xs text-ink-muted">
                <Tag className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{meal.tags.join(", ")}</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

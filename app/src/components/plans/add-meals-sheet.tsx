"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { MealImage } from "@/components/meals/meal-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export interface PickableMeal {
  id: string;
  name: string;
  imageHash: string | null;
  servings: number | null;
  tags: string[];
}

/**
 * Multi-select picker for adding meals to a plan.
 *
 * Meals already in the plan are filtered out server-side, so everything shown
 * here can genuinely be added.
 */
export function AddMealsSheet({
  meals,
  action,
}: {
  meals: PickableMeal[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const visible = filter.trim()
    ? meals.filter((m) => {
        const term = filter.trim().toLowerCase();
        return (
          m.name.toLowerCase().includes(term) ||
          m.tags.some((t) => t.toLowerCase().includes(term))
        );
      })
    : meals;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Add meals
        </Button>
      </SheetTrigger>

      <SheetContent
        title="Add meals"
        description={
          meals.length === 0
            ? "Every meal is already in this plan."
            : "Pick one or more to append to the plan."
        }
      >
        {meals.length > 0 && (
          <form action={action} className="flex min-h-0 flex-col gap-3">
            <Input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter meals or tags"
              aria-label="Filter meals or tags"
            />

            <ul className="-mx-1 max-h-[45vh] overflow-y-auto px-1">
              {visible.map((meal) => (
                <li key={meal.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      name="mealId"
                      value={meal.id}
                      className="size-4 shrink-0 accent-[var(--color-primary)]"
                    />
                    <MealImage
                      mealId={meal.id}
                      imageHash={meal.imageHash}
                      name={meal.name}
                      size="thumb"
                      className="size-10 shrink-0 rounded-lg"
                    />
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {meal.name}
                    </span>
                  </label>
                </li>
              ))}
              {visible.length === 0 && (
                <li className="px-2 py-6 text-center text-sm text-ink-muted">
                  Nothing matches “{filter}”.
                </li>
              )}
            </ul>

            <Button type="submit" className="w-full">
              Add selected
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

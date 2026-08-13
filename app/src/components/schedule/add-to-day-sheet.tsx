"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { MealImage } from "@/components/meals/meal-image";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";

export interface SchedulableMeal {
  id: string;
  name: string;
  imageHash: string | null;
  servings: number | null;
  tags: string[];
}

export function AddToDaySheet({
  dateLabel,
  slots,
  defaultSlot = "dinner",
  meals,
  action,
  variant = "button",
}: {
  dateLabel: string;
  slots: readonly { value: string; label: string }[];
  defaultSlot?: string;
  meals: SchedulableMeal[];
  action: (formData: FormData) => Promise<void>;
  variant?: "button" | "slot";
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
      <SheetTrigger
        aria-label={`Add a meal to ${dateLabel}`}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 font-medium transition-colors",
          variant === "button"
            ? "h-9 rounded-lg px-3 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
            : "h-11 w-full rounded-xl border border-dashed border-line text-sm text-ink-faint hover:border-line-strong hover:text-ink",
        )}
      >
        <Plus className="size-4" />
        Add
      </SheetTrigger>

      <SheetContent
        title={`Add to ${dateLabel}`}
        description={
          meals.length === 0
            ? "There are no meals yet. Create one first."
            : "Choose a slot, then pick one or more meals."
        }
      >
        {meals.length > 0 && (
          /*
           * The sheet is closed by the client after the Server Action
           * resolves. Unlike the plan actions, the schedule ones only
           * revalidate — they have nowhere to redirect to, since you stay on
           * the same day — so nothing would otherwise dismiss the sheet and it
           * would look as though the add had failed.
           */
          <form
            action={async (formData) => {
              await action(formData);
              setOpen(false);
            }}
            className="flex min-h-0 flex-col gap-3"
          >
            <Select name="slot" defaultValue={defaultSlot} aria-label="Slot">
              {slots.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </Select>

            <Input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter meals or tags"
              aria-label="Filter meals or tags"
            />

            <ul className="-mx-1 max-h-[40vh] overflow-y-auto px-1">
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
              Add to schedule
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

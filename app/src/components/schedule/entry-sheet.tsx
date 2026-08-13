"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { MealImage } from "@/components/meals/meal-image";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Field, Select } from "@/components/ui/field";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

/**
 * Tap a scheduled meal to move or remove it.
 *
 * Moving uses a native date input rather than drag-and-drop: on a phone the
 * OS date picker is a far more reliable way to reach "next Thursday" than
 * dragging across a cramped grid.
 */
export function EntrySheet({
  entryId,
  mealId,
  mealName,
  imageHash,
  date,
  slot,
  slots,
  today,
  weekStartsOn,
  moveAction,
  removeAction,
}: {
  entryId: string;
  mealId: string;
  mealName: string;
  imageHash: string | null;
  date: string;
  slot: string;
  slots: readonly { value: string; label: string }[];
  today: string;
  weekStartsOn: "monday" | "sunday";
  moveAction: (formData: FormData) => Promise<void>;
  removeAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-muted">
        <MealImage
          mealId={mealId}
          imageHash={imageHash}
          name={mealName}
          size="thumb"
          className="size-8 shrink-0 rounded-md"
        />
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{mealName}</span>
      </SheetTrigger>

      <SheetContent title={mealName} description="Move it, or take it off the schedule.">
        {/* Closed client-side once the action resolves; these actions only
            revalidate, so nothing else would dismiss the sheet. */}
        <form
          action={async (formData) => {
            await moveAction(formData);
            setOpen(false);
          }}
          className="flex flex-col gap-4"
        >
          {/* Full-width stacked on phones, two columns from `sm` — same rule
              as the shopping list's range picker. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Date" htmlFor={`${entryId}-date`}>
              <DateInput
                id={`${entryId}-date`}
                name="date"
                defaultValue={date}
                required
                today={today}
                weekStartsOn={weekStartsOn}
              />
            </Field>
            <Field label="Slot" htmlFor={`${entryId}-slot`}>
              <Select id={`${entryId}-slot`} name="slot" defaultValue={slot}>
                {slots.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Button type="submit">Move</Button>
        </form>

        <form
          action={async () => {
            await removeAction();
            setOpen(false);
          }}
          className="mt-2"
        >
          <Button
            type="submit"
            variant="ghost"
            className="w-full text-danger hover:bg-danger-soft"
          >
            <Trash2 className="size-4" />
            Remove from schedule
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

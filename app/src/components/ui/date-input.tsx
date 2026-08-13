"use client";

import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

import { control } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  addMonths,
  describeDate,
  isIsoDate,
  monthGrid,
  monthLabel,
  startOfMonth,
  weekdayLabels,
  type IsoDate,
  type WeekStart,
} from "@/lib/date-math";

/**
 * A date input styled to match every other text control, with a calendar
 * popover on desktop.
 *
 * Which affordance you get depends on the pointer (globals.css):
 *
 *  - **Coarse (phones):** the field itself is the tap target and opens the OS
 *    picker — the best control a phone has. The icon is decorative and
 *    `pointer-events-none`; a real button in that corner swallowed the tap,
 *    measured on-device.
 *  - **Fine, Chromium/WebKit:** the icon is a real button opening the styled
 *    calendar below; the native indicator is hidden outright.
 *  - **Fine, Firefox:** the button does not render (globals.css). Its native
 *    calendar icon lives in a compositing layer that a sibling element cannot
 *    occlude — checked with four different approaches against a real Firefox
 *    build, including an explicit z-index and an isolated stacking context,
 *    all left the native icon visible through or beside ours. Firefox's own
 *    picker is fully functional, so the field falls back to it rather than
 *    shipping a broken-looking overlay.
 *
 * `appearance: none` keeps the box identical everywhere; typing into the
 * day/month/year segments still works on every engine.
 *
 * `today` and `weekStartsOn` are props, not local computations: "today" is a
 * TZ question the server answers (docs/plan.md §3), and the week layout is
 * deployment config. Both come from the page.
 */
export function DateInput({
  today,
  weekStartsOn,
  className,
  ...props
}: React.ComponentProps<"input"> & {
  today: IsoDate;
  weekStartsOn: WeekStart;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<IsoDate | null>(null);
  const [anchor, setAnchor] = useState<IsoDate>(() => startOfMonth(today));

  /** Seed the calendar from whatever is in the field at the moment it opens. */
  function onOpenChange(next: boolean) {
    if (next) {
      const value = inputRef.current?.value ?? "";
      const seed = isIsoDate(value) ? value : today;
      setSelected(isIsoDate(value) ? value : null);
      setAnchor(startOfMonth(seed));
    }
    setOpen(next);
  }

  /**
   * Write the choice into the real input.
   *
   * Through the native value setter with a bubbled `input` event, not a prop:
   * React's own value tracking then treats it exactly like typing, so this one
   * path serves both the controlled usage (range picker) and the uncontrolled
   * form field (entry sheet) without the component needing to know which it is.
   */
  function select(date: IsoDate) {
    const input = inputRef.current;
    if (!input) return;

    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, date);
    input.dispatchEvent(new Event("input", { bubbles: true }));

    setOpen(false);
  }

  const min = typeof props.min === "string" ? props.min : undefined;
  const max = typeof props.max === "string" ? props.max : undefined;
  const inRange = (date: IsoDate) =>
    (!min || date >= min) && (!max || date <= max);

  const month = anchor.slice(0, 7);

  return (
    <div className="date-field relative min-w-0">
      <input
        ref={inputRef}
        type="date"
        className={cn(control, "h-11", className)}
        {...props}
      />

      {/* Coarse pointers: a cue, never a target. */}
      <CalendarDays
        aria-hidden
        className="date-field-icon pointer-events-none absolute top-1/2 right-3 size-[1.125rem] -translate-y-1/2 text-ink-muted"
      />

      {/* Fine pointers: the calendar. No Portal — portalling out of the
          entry sheet's Dialog would make every click in the calendar an
          "outside interaction" that dismisses the sheet. */}
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        {/* No backing needed: on the engines where this renders, the native
            indicator is already `display: none` (globals.css), so there is
            nothing underneath to hide. */}
        <Popover.Trigger
          aria-label="Open calendar"
          className="date-field-trigger absolute inset-y-0 right-0 w-11 items-center justify-center rounded-r-xl text-ink-muted transition-colors hover:text-ink"
        >
          <CalendarDays className="size-[1.125rem]" />
        </Popover.Trigger>

        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[19.5rem] rounded-xl border border-line bg-surface p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setAnchor(addMonths(anchor, -1))}
              className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium text-ink">
              {monthLabel(anchor)}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setAnchor(addMonths(anchor, 1))}
              className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7">
            {weekdayLabels(weekStartsOn, "narrow").map((label, i) => (
              // Narrow labels repeat (S, T…), so the key is positional.
              <span
                key={i}
                className="flex h-8 items-center justify-center text-xs font-medium text-ink-faint"
              >
                {label}
              </span>
            ))}

            {monthGrid(anchor, weekStartsOn).map((date) => {
              const parts = describeDate(date);
              const isSelected = date === selected;
              const inMonth = date.startsWith(month);

              return (
                <button
                  key={date}
                  type="button"
                  disabled={!inRange(date)}
                  aria-label={`${parts.day} ${parts.monthLong} ${parts.year}`}
                  aria-pressed={isSelected}
                  onClick={() => select(date)}
                  className={cn(
                    "mx-auto flex size-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors",
                    "disabled:pointer-events-none disabled:opacity-30",
                    isSelected
                      ? "bg-primary font-semibold text-on-primary"
                      : "hover:bg-surface-muted",
                    !isSelected && date === today && "font-semibold text-primary",
                    !isSelected && date !== today && (inMonth ? "text-ink" : "text-ink-faint"),
                  )}
                >
                  {parts.day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex justify-end border-t border-line pt-2">
            <button
              type="button"
              disabled={!inRange(today)}
              onClick={() => select(today)}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-40"
            >
              Today
            </button>
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}

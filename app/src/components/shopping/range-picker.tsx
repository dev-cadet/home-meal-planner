"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Field } from "@/components/ui/field";

const PRESETS = [
  { label: "This week", days: 0 },
  { label: "Next 7 days", days: 7 },
  { label: "Next 14 days", days: 14 },
] as const;

/**
 * Date range for the schedule's shopping list.
 *
 * Writes to the URL rather than component state, so a range is shareable and
 * survives a refresh — and the page stays a Server Component.
 */
export function RangePicker({
  from,
  to,
  weekFrom,
  weekTo,
  today,
  weekStartsOn,
}: {
  from: string;
  to: string;
  weekFrom: string;
  weekTo: string;
  today: string;
  weekStartsOn: "monday" | "sunday";
}) {
  const router = useRouter();
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);

  const go = (a: string, b: string) =>
    router.push(`/schedule/shopping-list?from=${a}&to=${b}`);

  /**
   * A preset moves the pickers as well as the range.
   *
   * Setting both ends together matters: the inputs constrain each other with
   * `min`/`max`, so writing one at a time can clamp the value being written.
   *
   * The state is also set rather than left to the navigation, so the fields
   * change the instant you tap instead of after the server responds.
   */
  const preset = (days: number) => {
    let a = weekFrom;
    let b = weekTo;

    if (days !== 0) {
      const later = new Date(`${today}T00:00:00Z`);
      later.setUTCDate(later.getUTCDate() + days - 1);
      a = today;
      b = later.toISOString().slice(0, 10);
    }

    setStart(a);
    setEnd(b);
    go(a, b);
  };

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant="secondary"
            size="sm"
            onClick={() => preset(p.days)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/*
        Stacked on phones, side by side from `sm`.
        Two date inputs will not fit across an iPhone: iOS gives them a wide
        intrinsic minimum, so a two-column grid overflowed the card and took
        the rest of the layout with it. A grid rather than flex-wrap, so
        Update can never end up sharing a row with one of the fields.
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="From" htmlFor="range-from">
            <DateInput
              id="range-from"
              value={start}
              max={end}
              onChange={(e) => setStart(e.target.value)}
              today={today}
              weekStartsOn={weekStartsOn}
            />
          </Field>
          <Field label="To" htmlFor="range-to">
            <DateInput
              id="range-to"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              today={today}
              weekStartsOn={weekStartsOn}
            />
          </Field>
        </div>
        <Button
          onClick={() => go(start, end)}
          className="w-full shrink-0 sm:w-auto"
        >
          Update
        </Button>
      </div>
    </div>
  );
}

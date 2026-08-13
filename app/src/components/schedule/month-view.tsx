import Link from "next/link";

import { cn } from "@/lib/cn";
import { describeDate, monthGrid, weekdayLabels, type IsoDate } from "@/lib/date";

/**
 * Month grid. Whole weeks, so leading and trailing days from adjacent months
 * are shown dimmed rather than left as gaps.
 *
 * Tapping a day opens the day view — a 375px cell has no room to edit in.
 */
export function MonthView({
  anchor,
  counts,
  today,
  weekStartsOn,
}: {
  anchor: IsoDate;
  counts: Map<IsoDate, number>;
  today: IsoDate;
  weekStartsOn: "monday" | "sunday";
}) {
  const days = monthGrid(anchor, weekStartsOn);
  const month = anchor.slice(0, 7);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line">
        {weekdayLabels(weekStartsOn).map((label) => (
          <div
            key={label}
            className="py-2 text-center text-xs font-medium text-ink-faint"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((date) => {
          const inMonth = date.startsWith(month);
          const isToday = date === today;
          const n = counts.get(date) ?? 0;

          return (
            <Link
              key={date}
              href={`/schedule?view=day&date=${date}`}
              aria-label={`${describeDate(date).weekdayLong} ${describeDate(date).day} ${describeDate(date).monthLong}, ${n} meal${n === 1 ? "" : "s"}`}
              className={cn(
                "flex min-h-16 flex-col items-center gap-1 border-t border-r border-line p-1.5 transition-colors last:border-r-0 hover:bg-surface-muted",
                "[&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-surface-muted/40",
              )}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
                  isToday && "bg-primary font-semibold text-on-primary",
                  !isToday && inMonth && "text-ink",
                  !isToday && !inMonth && "text-ink-faint",
                )}
              >
                {describeDate(date).day}
              </span>

              {n > 0 && (
                <span className="flex gap-0.5" aria-hidden>
                  {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "size-1.5 rounded-full",
                        inMonth ? "bg-primary" : "bg-ink-faint",
                      )}
                    />
                  ))}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

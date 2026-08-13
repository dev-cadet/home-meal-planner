import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import type { IsoDate } from "@/lib/date";

export type ScheduleView = "day" | "week" | "month";

const VIEWS: ScheduleView[] = ["day", "week", "month"];

/** Period stepper. Plain links, so no client JavaScript. */
export function ScheduleNav({
  view,
  title,
  previous,
  next,
  today,
}: {
  view: ScheduleView;
  title: string;
  previous: IsoDate;
  next: IsoDate;
  today: IsoDate;
}) {
  const href = (date: IsoDate) => `/schedule?view=${view}&date=${date}`;

  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <Link
          href={href(previous)}
          aria-label={`Previous ${view}`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <Link
          href={href(next)}
          aria-label={`Next ${view}`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <ChevronRight className="size-5" />
        </Link>
        <h2 className="ml-1 truncate text-base font-semibold text-ink">{title}</h2>
      </div>

      <Link
        href={href(today)}
        className="inline-flex h-9 shrink-0 items-center rounded-lg border border-line px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
      >
        Today
      </Link>
    </div>
  );
}

export function ViewSwitcher({
  view,
  date,
}: {
  view: ScheduleView;
  date: IsoDate;
}) {
  return (
    <nav
      aria-label="Schedule view"
      className="mb-4 flex rounded-xl border border-line bg-surface p-1"
    >
      {VIEWS.map((v) => (
        <Link
          key={v}
          href={`/schedule?view=${v}&date=${date}`}
          aria-current={v === view ? "page" : undefined}
          className={cn(
            "flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-medium capitalize transition-colors",
            v === view
              ? "bg-primary-soft text-primary"
              : "text-ink-muted hover:text-ink",
          )}
        >
          {v}
        </Link>
      ))}
    </nav>
  );
}

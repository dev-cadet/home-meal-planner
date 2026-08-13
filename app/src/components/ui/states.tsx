import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

/** Page heading used by every route shell. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {description && <p className="text-ink-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/**
 * Shown when a collection is genuinely empty — as opposed to loading or
 * broken. Always names the next action, so an empty screen is never a
 * dead end.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-muted text-ink-faint">
        <Icon className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-ink">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-ink-muted">{description}</p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Placeholder block for loading.tsx files. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-lg bg-surface-muted", className)}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";
import type { TagOption } from "@/lib/tags/queries";

import { Sheet, SheetContent, SheetTrigger } from "./sheet";

const ROW_SIZE = 10;

function Chip({
  name,
  active,
  onClick,
}: {
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {name}
    </button>
  );
}

/**
 * Tag filter for the Meals/Plans list pages. Shows the most-recently-used
 * tags, pulling any currently-active tag to the front even if it fell out of
 * that recent set (picked earlier from "Show more"). Filter state lives in
 * the URL as repeated `?tag=` params, so it survives a refresh and is
 * shareable.
 */
export function TagFilterRow({ recent, all }: { recent: TagOption[]; all: TagOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showMore, setShowMore] = useState(false);

  const active = new Set(searchParams.getAll("tag"));

  function toggle(name: string) {
    const params = new URLSearchParams(searchParams);
    const current = params.getAll("tag");
    params.delete("tag");
    const next = current.includes(name)
      ? current.filter((t) => t !== name)
      : [...current, name];
    for (const t of next) params.append("tag", t);
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  if (all.length === 0) return null;

  const activeChips = all.filter((t) => active.has(t.name));
  const inactiveRecent = recent.filter((t) => !active.has(t.name));
  const fillCount = Math.max(0, ROW_SIZE - activeChips.length);
  const row = [...activeChips, ...inactiveRecent.slice(0, fillCount)];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {row.map((t) => (
        <Chip key={t.id} name={t.name} active={active.has(t.name)} onClick={() => toggle(t.name)} />
      ))}

      {all.length > row.length && (
        <Sheet open={showMore} onOpenChange={setShowMore}>
          <SheetTrigger className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink">
            Show more
            <ChevronDown className="size-3.5" />
          </SheetTrigger>
          <SheetContent title="All tags" description="Pick any number to filter the list.">
            <div className="flex max-h-[50vh] flex-wrap gap-2 overflow-y-auto py-1">
              {all.map((t) => (
                <Chip
                  key={t.id}
                  name={t.name}
                  active={active.has(t.name)}
                  onClick={() => toggle(t.name)}
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

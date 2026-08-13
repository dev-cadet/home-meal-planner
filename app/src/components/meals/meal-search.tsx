"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/field";

/**
 * Debounced live search that writes to the URL, so a filtered list is
 * shareable and survives a refresh or a back-navigation.
 */
export function MealSearch({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirst = useRef(true);

  useEffect(() => {
    // Don't re-push the URL we just arrived on.
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");

      // `useSearchParams()` hands back a new object on every navigation, even
      // when the query string itself is unchanged — so without this check, a
      // `replace()` here would put a "changed" `searchParams` back into this
      // effect's own dependency array, re-firing it forever on a 250ms loop.
      const next = params.toString();
      if (next === searchParams.toString()) return;

      router.replace(`${pathname}?${next}`, { scroll: false });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, pathname, router, searchParams]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search meals and steps"
        aria-label="Search meals"
        className="pr-10 pl-9"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setValue("")}
          className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-faint hover:bg-surface-muted hover:text-ink"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";

import { cn } from "@/lib/cn";
import { setPaletteAction } from "@/lib/settings/actions";
import { STANDARD_PALETTES } from "@/lib/theme/palettes";

/**
 * A vertical list, not a toggle — `STANDARD_PALETTES` is meant to grow (Nord,
 * Gruvbox, Dracula, Catppuccin, …), and a row of pill buttons stops reading
 * as a single choice once there are more than two or three of them.
 */
export function PalettePicker({ current }: { current: string }) {
  const [pending, startTransition] = useTransition();

  function choose(id: string) {
    // Apply immediately so the change is instant, then persist. Waiting for
    // the round trip would make the picker feel broken.
    document.documentElement.setAttribute("data-palette", id);
    startTransition(() => setPaletteAction(id));
  }

  return (
    <div
      role="radiogroup"
      aria-label="Palette"
      className={cn(
        "flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface",
        pending && "opacity-70",
      )}
    >
      {STANDARD_PALETTES.map((palette) => {
        const active = palette.id === current;

        return (
          <button
            key={palette.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(palette.id)}
            className={cn(
              "flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium transition-colors",
              active ? "text-primary" : "text-ink hover:bg-surface-muted",
            )}
          >
            {palette.label}
            {active && <Check className="size-4" />}
          </button>
        );
      })}
    </div>
  );
}

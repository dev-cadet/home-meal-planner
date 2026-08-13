"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { setFestiveEnabledAction, setFestiveOptOutAction } from "@/lib/settings/actions";
import { FESTIVE_PALETTES } from "@/lib/theme/palettes";

export function FestiveSettings({
  enabled,
  disabledIds,
}: {
  enabled: boolean;
  disabledIds: string[];
}) {
  const [, startTransition] = useTransition();
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [localDisabled, setLocalDisabled] = useState(() => new Set(disabledIds));

  function setEnabled(next: boolean) {
    setLocalEnabled(next);
    startTransition(() => setFestiveEnabledAction(next));
  }

  function toggleHoliday(id: string) {
    const next = new Set(localDisabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setLocalDisabled(next);
    startTransition(() => setFestiveOptOutAction(Array.from(next)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label="Use festive theming"
        className="flex w-48 rounded-xl border border-line bg-surface p-1"
      >
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            role="radio"
            aria-checked={localEnabled === value}
            onClick={() => setEnabled(value)}
            className={cn(
              "h-9 flex-1 rounded-lg text-sm font-medium transition-colors",
              localEnabled === value
                ? "bg-primary-soft text-primary"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {value ? "On" : "Off"}
          </button>
        ))}
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary" size="sm" className="self-start">
            Manage holidays
          </Button>
        </SheetTrigger>
        <SheetContent
          title="Festive holidays"
          description="Choose which holidays can apply a themed palette during their month."
        >
          <div className="flex flex-col divide-y divide-line">
            {FESTIVE_PALETTES.map((holiday) => {
              const isEnabled = !localDisabled.has(holiday.id);
              return (
                <button
                  key={holiday.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isEnabled}
                  onClick={() => toggleHoliday(holiday.id)}
                  className="flex items-center justify-between gap-3 py-3 text-left text-sm text-ink"
                >
                  {holiday.label}
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border",
                      isEnabled
                        ? "border-primary bg-primary text-on-primary"
                        : "border-line-strong text-transparent",
                    )}
                  >
                    <Check className="size-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

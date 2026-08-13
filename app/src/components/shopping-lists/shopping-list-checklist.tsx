"use client";

import { Check, RotateCcw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import {
  removeShoppingListItemAction,
  resetShoppingListCheckedAction,
  toggleShoppingListItemAction,
} from "@/lib/shopping-lists/actions";
import type { SavedShoppingListItem } from "@/lib/shopping-lists/records";
import { formatMeasure } from "@/lib/units";

/**
 * The one interactive part of a saved list. Checking an item off, or
 * removing one, persists immediately — no save button anywhere on this page.
 * Local state applies each change instantly (same pattern as the palette
 * picker) while the server action confirms in the background. Items *added*
 * via the page-level form need no local state here — they arrive through the
 * `items` prop when the page revalidates.
 */
export function ShoppingListChecklist({
  listId,
  items,
}: {
  listId: string;
  items: SavedShoppingListItem[];
}) {
  const [, startTransition] = useTransition();
  const [checkedIds, setCheckedIds] = useState(
    () => new Set(items.filter((item) => item.checked).map((item) => item.id)),
  );
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());

  function toggle(itemId: string) {
    const next = new Set(checkedIds);
    const checked = !next.has(itemId);
    if (checked) next.add(itemId);
    else next.delete(itemId);
    setCheckedIds(next);

    startTransition(() => toggleShoppingListItemAction(listId, itemId, checked));
  }

  function remove(itemId: string) {
    setRemovedIds((prev) => new Set(prev).add(itemId));

    startTransition(() => removeShoppingListItemAction(listId, itemId));
  }

  function resetChecked() {
    setCheckedIds(new Set());

    startTransition(() => resetShoppingListCheckedAction(listId));
  }

  const visibleItems = items.filter((item) => !removedIds.has(item.id));
  const checkedCount = visibleItems.filter((item) => checkedIds.has(item.id)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          {checkedCount} of {visibleItems.length} checked.
        </p>
        {checkedCount > 0 && (
          <button
            type="button"
            onClick={resetChecked}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <RotateCcw className="size-3.5" />
            Reset checked
          </button>
        )}
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {visibleItems.map((item) => {
          const checked = checkedIds.has(item.id);
          return (
            <li key={item.id} className="flex items-center gap-1 pr-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(item.id)}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border",
                    checked
                      ? "border-primary bg-primary text-on-primary"
                      : "border-line-strong text-transparent",
                  )}
                >
                  <Check className="size-3.5" />
                </span>
                <span
                  className={cn(
                    "flex-1 text-ink",
                    checked && "text-ink-faint line-through",
                  )}
                >
                  {item.name}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-right text-sm font-medium text-ink-muted tabular-nums",
                    checked && "text-ink-faint line-through",
                  )}
                >
                  {item.measures.map(formatMeasure).join(" + ")}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => remove(item.id)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

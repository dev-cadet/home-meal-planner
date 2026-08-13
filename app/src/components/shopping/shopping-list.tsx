import { ShoppingBasket } from "lucide-react";

import { ShareList } from "@/components/shopping/share-list";
import { EmptyState } from "@/components/ui/states";
import { formatMeasure } from "@/lib/units";
import {
  formatShoppingText,
  type ShoppingItem,
} from "@/lib/shopping/aggregate";

/**
 * The rendered list.
 *
 * Read-only per item by design (docs/plan.md §6): no tick boxes, no stored
 * state for any single line. `saveAction` is the one whole-list exception —
 * it hands the list off to `lib/shopping-lists`, which snapshots it
 * somewhere a user *can* tick items off, without this component itself
 * holding or mutating anything.
 */
export function ShoppingList({
  items,
  heading,
  mealNames,
  occurrences,
  emptyMessage,
  saveAction,
}: {
  items: ShoppingItem[];
  heading: string;
  mealNames: string[];
  occurrences: number;
  emptyMessage: string;
  saveAction?: React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBasket}
        title="Nothing to buy"
        description={emptyMessage}
      />
    );
  }

  const text = formatShoppingText(items, heading);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {items.length} item{items.length === 1 ? "" : "s"} from{" "}
          {mealNames.length} meal{mealNames.length === 1 ? "" : "s"}
          {occurrences > mealNames.length && ` (${occurrences} servings planned)`}
          .
        </p>
        <div className="flex flex-wrap gap-2">
          {saveAction}
          <ShareList text={text} title={heading} />
        </div>
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-baseline justify-between gap-4 px-4 py-3"
          >
            <span className="text-ink">{item.name}</span>
            <span className="shrink-0 text-right text-sm font-medium text-ink-muted tabular-nums">
              {item.measures.map(formatMeasure).join(" + ")}
            </span>
          </li>
        ))}
      </ul>

      <details className="rounded-2xl border border-line bg-surface px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-ink-muted">
          From these meals
        </summary>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-muted">
          {mealNames.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

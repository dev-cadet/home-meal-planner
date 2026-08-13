import { Pin, ShoppingBasket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { formatInstant } from "@/lib/date";
import { togglePinShoppingListAction } from "@/lib/shopping-lists/actions";
import { listShoppingLists } from "@/lib/shopping-lists/queries";
import type { SavedShoppingListSummary } from "@/lib/shopping-lists/records";

export const metadata: Metadata = { title: "Shopping Lists · Home Meal Planner" };

function ShoppingListRows({ lists }: { lists: SavedShoppingListSummary[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {lists.map((list) => (
        <li
          key={list.id}
          className="flex items-center transition-colors hover:bg-surface-muted"
        >
          <form action={togglePinShoppingListAction.bind(null, list.id, !list.pinned)}>
            <button
              type="submit"
              aria-label={list.pinned ? "Unpin" : "Pin"}
              className={cn(
                "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center transition-colors",
                list.pinned
                  ? "text-primary hover:text-primary-hover"
                  : "text-ink-faint hover:text-ink",
              )}
            >
              <Pin className={cn("size-4", list.pinned && "fill-current")} />
            </button>
          </form>
          <Link
            href={`/shopping-lists/${list.id}`}
            className="flex min-w-0 flex-1 items-center justify-between gap-4 py-3.5 pr-4"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium text-ink">{list.name}</span>
              <span className="text-sm text-ink-muted">{formatInstant(list.createdAt)}</span>
            </div>
            <span className="shrink-0 text-right text-sm font-medium text-ink-muted tabular-nums">
              {list.checkedCount} of {list.itemCount} checked
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function ShoppingListsPage() {
  const lists = await listShoppingLists();
  const pinned = lists.filter((list) => list.pinned);
  const others = lists.filter((list) => !list.pinned);

  return (
    <>
      <PageHeader
        title="Shopping Lists"
        description="Saved from a plan, the schedule, or started blank — just for you."
        actions={
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/shopping-lists/new">Blank list</Link>
          </Button>
        }
      />

      {lists.length === 0 ? (
        <EmptyState
          icon={ShoppingBasket}
          title="No saved lists yet"
          description="Generate a shopping list from a plan or the schedule, or start a blank one, then save it here to check items off."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {pinned.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
                Pinned
              </h3>
              <ShoppingListRows lists={pinned} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            {pinned.length > 0 && (
              <h3 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
                All lists
              </h3>
            )}
            <ShoppingListRows lists={others} />
          </div>
        </div>
      )}
    </>
  );
}

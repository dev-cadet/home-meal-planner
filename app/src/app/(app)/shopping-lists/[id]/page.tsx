import { ArrowLeft, Pin, PinOff, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ShoppingListChecklist } from "@/components/shopping-lists/shopping-list-checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/states";
import {
  addShoppingListItemAction,
  deleteShoppingListAction,
  renameShoppingListAction,
  togglePinShoppingListAction,
} from "@/lib/shopping-lists/actions";
import { getShoppingList } from "@/lib/shopping-lists/queries";

export async function generateMetadata({
  params,
}: PageProps<"/shopping-lists/[id]">): Promise<Metadata> {
  const { id } = await params;
  const list = await getShoppingList(id);
  if (!list) notFound();
  return { title: `${list.name} · Shopping Lists` };
}

export default async function ShoppingListDetailPage({
  params,
}: PageProps<"/shopping-lists/[id]">) {
  const { id } = await params;
  const list = await getShoppingList(id);
  if (!list) notFound();

  return (
    <>
      <PageHeader
        title={list.name}
        actions={
          <div className="flex gap-2">
            <form action={togglePinShoppingListAction.bind(null, list.id, !list.pinned)}>
              <Button type="submit" variant="ghost" size="sm">
                {list.pinned ? (
                  <PinOff className="size-4" />
                ) : (
                  <Pin className="size-4" />
                )}
                {list.pinned ? "Unpin" : "Pin"}
              </Button>
            </form>
            <Button asChild variant="ghost" size="sm">
              <Link href="/shopping-lists">
                <ArrowLeft className="size-4" />
                Lists
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <ShoppingListChecklist listId={list.id} items={list.items} />

        <form
          action={addShoppingListItemAction.bind(null, list.id)}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <Input
            name="name"
            placeholder="Add an item"
            required
            maxLength={200}
            aria-label="Item name"
            className="sm:flex-1"
          />
          {/* No explicit height: `sm:h-auto` cancels the size="sm" default so
              the row's `items-stretch` (the flex default) matches it to the
              input's height instead of a hardcoded value. On mobile, where
              this stacks onto its own row, the size="sm" height applies as
              normal. */}
          <Button type="submit" variant="secondary" size="sm" className="sm:h-auto">
            <Plus className="size-4" />
            Add
          </Button>
        </form>

        <details className="rounded-2xl border border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-muted">
            Rename list
          </summary>
          <form
            action={renameShoppingListAction.bind(null, list.id)}
            className="mt-3 flex flex-col gap-2 sm:flex-row"
          >
            <Input
              name="name"
              defaultValue={list.name}
              required
              maxLength={160}
              aria-label="List name"
              className="sm:flex-1"
            />
            <Button type="submit" size="sm" className="sm:h-auto">
              Save name
            </Button>
          </form>
        </details>

        <form action={deleteShoppingListAction.bind(null, list.id)} className="self-start">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-danger hover:bg-danger-soft"
          >
            Delete list
          </Button>
        </form>
      </div>
    </>
  );
}

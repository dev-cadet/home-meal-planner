"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

/**
 * Deleting a meal cascades to its ingredients, image, plan items and schedule
 * entries. Those consequences are named before the fact rather than discovered
 * afterwards — there is no undo.
 */
export function DeleteMeal({
  name,
  references,
  action,
}: {
  name: string;
  references: { plans: number; scheduled: number };
  action: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const consequences: string[] = [];

  if (references.plans > 0) {
    consequences.push(
      `${references.plans} plan${references.plans === 1 ? "" : "s"}`,
    );
  }
  if (references.scheduled > 0) {
    consequences.push(
      `${references.scheduled} scheduled meal${references.scheduled === 1 ? "" : "s"}`,
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft">
          <Trash2 className="size-4" />
          Delete
        </Button>
      </SheetTrigger>

      <SheetContent
        title={`Delete “${name}”?`}
        description="This cannot be undone."
      >
        {consequences.length > 0 && (
          <p className="mb-4 rounded-xl border border-danger/40 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            It will also be removed from {consequences.join(" and ")}.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <form action={action}>
            <Button type="submit" variant="danger" className="w-full sm:w-auto">
              Delete meal
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

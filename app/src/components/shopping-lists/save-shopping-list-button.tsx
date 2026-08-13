"use client";

import { Save } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

/**
 * Saving is a snapshot, not an upsert — saving the same source twice makes
 * two independent lists. When one already exists, this confirms first
 * (mirrors `DeleteMeal`'s Sheet-based confirm) rather than silently doubling
 * up on an accidental re-click.
 */
export function SaveShoppingListButton({
  action,
  alreadySaved,
}: {
  action: () => Promise<void>;
  alreadySaved: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!alreadySaved) {
    return (
      <form action={action}>
        <Button type="submit" variant="secondary" size="sm">
          <Save className="size-4" />
          Save
        </Button>
      </form>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm">
          <Save className="size-4" />
          Save
        </Button>
      </SheetTrigger>

      <SheetContent
        title="Save another list?"
        description="You already have a saved list from this — saving again keeps both as separate copies."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <form action={action}>
            <Button type="submit" className="w-full sm:w-auto">
              Save anyway
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

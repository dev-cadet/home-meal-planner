import type { Metadata } from "next";

import { BlankShoppingListForm } from "@/components/shopping-lists/blank-shopping-list-form";
import { PageHeader } from "@/components/ui/states";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "New shopping list · Home Meal Planner" };

export default async function NewShoppingListPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="New shopping list"
        description="Not tied to a recipe — just a list."
      />
      <BlankShoppingListForm />
    </>
  );
}

import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SaveShoppingListButton } from "@/components/shopping-lists/save-shopping-list-button";
import { ShoppingList } from "@/components/shopping/shopping-list";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/states";
import { config } from "@/lib/config";
import { getPlan } from "@/lib/plans/queries";
import { aggregate } from "@/lib/shopping/aggregate";
import { ingredientsForPlan } from "@/lib/shopping/queries";
import { saveShoppingListFromPlanAction } from "@/lib/shopping-lists/actions";
import { defaultShoppingListNameForPlan } from "@/lib/shopping-lists/naming";
import { hasShoppingListNamed } from "@/lib/shopping-lists/queries";

export async function generateMetadata({
  params,
}: PageProps<"/plans/[id]/shopping-list">): Promise<Metadata> {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();
  return { title: `Shopping list · ${plan.name}` };
}

export default async function PlanShoppingListPage({
  params,
}: PageProps<"/plans/[id]/shopping-list">) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();

  const source = await ingredientsForPlan(id);
  const items = aggregate(source.lines, config.MEASUREMENT_SYSTEM);
  const alreadySaved =
    items.length > 0 && (await hasShoppingListNamed(defaultShoppingListNameForPlan(plan.name)));

  return (
    <>
      <PageHeader
        title="Shopping list"
        description={`Everything in “${plan.name}”, combined.`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href={`/plans/${plan.id}`}>
              <ArrowLeft className="size-4" />
              Plan
            </Link>
          </Button>
        }
      />

      <ShoppingList
        items={items}
        heading={`Shopping list — ${plan.name}`}
        mealNames={source.mealNames}
        occurrences={source.occurrences}
        emptyMessage="This plan has no meals with ingredients yet."
        saveAction={
          <SaveShoppingListButton
            action={saveShoppingListFromPlanAction.bind(null, plan.id)}
            alreadySaved={alreadySaved}
          />
        }
      />
    </>
  );
}

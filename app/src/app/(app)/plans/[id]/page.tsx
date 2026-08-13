import { CookingPot, Pencil, Pin, PinOff, ShoppingBasket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddMealsSheet } from "@/components/plans/add-meals-sheet";
import { PlanMeals } from "@/components/plans/plan-meals";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { addMealsToPlanAction, deletePlanAction, togglePinPlanAction } from "@/lib/plans/actions";
import { getPlan, mealsNotInPlan } from "@/lib/plans/queries";

export async function generateMetadata({
  params,
}: PageProps<"/plans/[id]">): Promise<Metadata> {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();
  return { title: `${plan.name} · Home Meal Planner` };
}

export default async function PlanDetailPage({
  params,
}: PageProps<"/plans/[id]">) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();

  const available = await mealsNotInPlan(id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            {plan.name}
          </h2>
          {plan.description && (
            <p className="text-ink-muted">{plan.description}</p>
          )}
          <p className="text-sm text-ink-faint">
            {plan.meals.length} meal{plan.meals.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <form action={togglePinPlanAction.bind(null, plan.id, !plan.pinned)}>
            <Button type="submit" variant="ghost" size="sm">
              {plan.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              {plan.pinned ? "Unpin" : "Pin"}
            </Button>
          </form>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/plans/${plan.id}/shopping-list`}>
              <ShoppingBasket className="size-4" />
              Shopping list
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/plans/${plan.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-ink-muted">Meals in order</h3>
        <AddMealsSheet
          meals={available}
          action={addMealsToPlanAction.bind(null, plan.id)}
        />
      </div>

      {plan.meals.length === 0 ? (
        <EmptyState
          icon={CookingPot}
          title="This plan is empty"
          description="Add meals to build the playlist. Their order is up to you — it is how the plan reads, and how the shopping list is grouped."
        />
      ) : (
        <PlanMeals planId={plan.id} meals={plan.meals} />
      )}

      <footer className="flex items-center justify-between gap-4 border-t border-line pt-4 text-xs text-ink-faint">
        <span>Created by {plan.createdByName ?? "a deleted user"}.</span>
        <form action={deletePlanAction.bind(null, plan.id)}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-danger hover:bg-danger-soft"
          >
            Delete plan
          </Button>
        </form>
      </footer>
    </div>
  );
}

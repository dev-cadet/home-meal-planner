import { ListMusic, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PlanCard } from "@/components/plans/plan-card";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { TagFilterRow } from "@/components/ui/tag-filter-row";
import { listPlans, type PlanListItem } from "@/lib/plans/queries";
import { allMealTagsUsed, recentMealTags } from "@/lib/tags/queries";

export const metadata: Metadata = { title: "Plans · Home Meal Planner" };

function PlanGrid({ plans }: { plans: PlanListItem[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {plans.map((plan) => (
        <li key={plan.id} className="contents">
          <PlanCard plan={plan} />
        </li>
      ))}
    </ul>
  );
}

export default async function PlansPage({
  searchParams,
}: PageProps<"/plans">) {
  const { tag } = await searchParams;
  const tags = tag === undefined ? [] : Array.isArray(tag) ? tag : [tag];

  // Plans have no tags of their own — filtering and the chip row both use
  // the recipe (meal) tag vocabulary; a plan matches when its meals,
  // collectively, cover every selected tag (see listPlans).
  const [plans, recentTags, allTags] = await Promise.all([
    listPlans(undefined, tags),
    recentMealTags(),
    allMealTagsUsed(),
  ]);
  const pinnedPlans = plans.filter((p) => p.pinned);
  const otherPlans = plans.filter((p) => !p.pinned);

  return (
    <>
      <PageHeader
        title="Plans"
        description="Playlists of meals. No dates — just groupings you can shop for."
        actions={
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/plans/new">New plan</Link>
          </Button>
        }
      />

      <div className="mb-5">
        <TagFilterRow recent={recentTags} all={allTags} />
      </div>

      {plans.length === 0 && tags.length > 0 && (
        <EmptyState
          icon={SearchX}
          title="No plans match those tags"
          description="Clear a tag to widen the search."
        />
      )}

      {plans.length === 0 && tags.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="No plans yet"
          description="Group meals you cook together — a weeknight rotation, a batch-cook Sunday — then generate a shopping list from the whole plan."
          action={
            <Button asChild>
              <Link href="/plans/new">Create a plan</Link>
            </Button>
          }
        />
      ) : plans.length > 0 ? (
        <div className="flex flex-col gap-6">
          {pinnedPlans.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
                Pinned
              </h3>
              <PlanGrid plans={pinnedPlans} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            {pinnedPlans.length > 0 && (
              <h3 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
                All plans
              </h3>
            )}
            <PlanGrid plans={otherPlans} />
          </div>
        </div>
      ) : null}
    </>
  );
}

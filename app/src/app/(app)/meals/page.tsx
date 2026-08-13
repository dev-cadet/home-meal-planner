import { CookingPot, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MealCard } from "@/components/meals/meal-card";
import { MealSearch } from "@/components/meals/meal-search";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { TagFilterRow } from "@/components/ui/tag-filter-row";
import { listMeals, type MealListItem } from "@/lib/meals/queries";
import { allMealTagsUsed, recentMealTags } from "@/lib/tags/queries";

export const metadata: Metadata = { title: "Meals · Home Meal Planner" };

function MealGrid({ meals }: { meals: MealListItem[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {meals.map((meal) => (
        <li key={meal.id} className="contents">
          <MealCard meal={meal} />
        </li>
      ))}
    </ul>
  );
}

export default async function MealsPage({
  searchParams,
}: PageProps<"/meals">) {
  const { q, tag } = await searchParams;
  const search = typeof q === "string" ? q : "";
  const tags = tag === undefined ? [] : Array.isArray(tag) ? tag : [tag];

  const [meals, recentTags, allTags] = await Promise.all([
    listMeals(search, tags),
    recentMealTags(),
    allMealTagsUsed(),
  ]);
  const pinnedMeals = meals.filter((m) => m.pinned);
  const otherMeals = meals.filter((m) => !m.pinned);

  return (
    <>
      <PageHeader
        title="Meals"
        description="Every recipe in the house."
        actions={
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/meals/new">New meal</Link>
          </Button>
        }
      />

      <div className="mb-4">
        <MealSearch initial={search} />
      </div>

      <div className="mb-5">
        <TagFilterRow recent={recentTags} all={allTags} />
      </div>

      {meals.length === 0 && (search !== "" || tags.length > 0) && (
        <EmptyState
          icon={SearchX}
          title={search !== "" ? `No meals match “${search}”` : "No meals match those tags"}
          description="Try a different word, or clear a tag to widen the search."
        />
      )}

      {meals.length === 0 && search === "" && tags.length === 0 && (
        <EmptyState
          icon={CookingPot}
          title="No meals yet"
          description="Add your first recipe with its ingredients, and it becomes available to plans, the schedule and shopping lists."
          action={
            <Button asChild>
              <Link href="/meals/new">Add a meal</Link>
            </Button>
          }
        />
      )}

      {meals.length > 0 && (
        <div className="flex flex-col gap-6">
          {pinnedMeals.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
                Pinned
              </h3>
              <MealGrid meals={pinnedMeals} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            {pinnedMeals.length > 0 && (
              <h3 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
                All meals
              </h3>
            )}
            <MealGrid meals={otherMeals} />
          </div>
        </div>
      )}
    </>
  );
}

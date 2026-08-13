import type { Metadata } from "next";

import { MealForm } from "@/components/meals/meal-form";
import { PageHeader } from "@/components/ui/states";
import { requireUser } from "@/lib/auth/dal";
import { config } from "@/lib/config";
import { createMealAction } from "@/lib/meals/actions";
import { allMealTagNames, recentlyUsedMealTagNames } from "@/lib/tags/queries";

export const metadata: Metadata = { title: "New meal · Home Meal Planner" };

export default async function NewMealPage() {
  await requireUser();
  const [tagSuggestions, recentTags] = await Promise.all([
    allMealTagNames(),
    recentlyUsedMealTagNames(),
  ]);

  return (
    <>
      <PageHeader title="New meal" />
      <MealForm
        action={createMealAction}
        submitLabel="Create meal"
        defaultUnit={config.MEASUREMENT_SYSTEM === "imperial" ? "oz" : "g"}
        tagSuggestions={tagSuggestions}
        recentTags={recentTags}
        values={{
          name: "",
          servings: "",
          prepMins: "",
          cookMins: "",
          imageHash: null,
          ingredients: [],
          steps: [],
          tags: [],
        }}
      />
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MealForm } from "@/components/meals/meal-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/states";
import { config } from "@/lib/config";
import { removeMealImageAction, updateMealAction } from "@/lib/meals/actions";
import { getMeal } from "@/lib/meals/queries";
import { allMealTagNames, recentlyUsedMealTagNames, tagsForMeal } from "@/lib/tags/queries";

export async function generateMetadata({
  params,
}: PageProps<"/meals/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  // Checked here, not just in the body: loading.tsx makes this route stream,
  // so a notFound() below would render the 404 page with a 200 status.
  if (!(await getMeal(id))) notFound();
  return { title: "Edit meal · Home Meal Planner" };
}

export default async function EditMealPage({
  params,
}: PageProps<"/meals/[id]/edit">) {
  const { id } = await params;
  const meal = await getMeal(id);
  if (!meal) notFound();

  const [tagSuggestions, recentTags, tags] = await Promise.all([
    allMealTagNames(),
    recentlyUsedMealTagNames(),
    tagsForMeal(id),
  ]);

  return (
    <>
      <PageHeader
        title="Edit meal"
        actions={
          meal.imageHash ? (
            <form action={removeMealImageAction.bind(null, meal.id)}>
              <Button type="submit" variant="ghost" size="sm">
                Remove photo
              </Button>
            </form>
          ) : null
        }
      />

      <MealForm
        action={updateMealAction.bind(null, meal.id)}
        submitLabel="Save changes"
        defaultUnit={config.MEASUREMENT_SYSTEM === "imperial" ? "oz" : "g"}
        tagSuggestions={tagSuggestions}
        recentTags={recentTags}
        values={{
          id: meal.id,
          name: meal.name,
          servings: meal.servings?.toString() ?? "",
          prepMins: meal.prepMins?.toString() ?? "",
          cookMins: meal.cookMins?.toString() ?? "",
          imageHash: meal.imageHash,
          ingredients: meal.ingredients.map((i) => ({
            quantity: i.quantity,
            unit: i.unit,
            name: i.name,
          })),
          steps: meal.steps.map((s) => s.text),
          tags,
        }}
      />
    </>
  );
}

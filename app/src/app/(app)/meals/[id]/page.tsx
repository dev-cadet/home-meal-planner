import { Clock, Pencil, Pin, PinOff, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteMeal } from "@/components/meals/delete-meal";
import { MealImage } from "@/components/meals/meal-image";
import { Button } from "@/components/ui/button";
import { deleteMealAction, togglePinMealAction } from "@/lib/meals/actions";
import { getMeal, mealReferences } from "@/lib/meals/queries";
import { formatMeasure } from "@/lib/units";

export async function generateMetadata({
  params,
}: PageProps<"/meals/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meal = await getMeal(id);
  // Resolved before the response commits. A Suspense boundary (loading.tsx)
  // makes the route stream, so calling notFound() in the body below would
  // render the 404 page but leave the status stuck at 200 — headers are
  // already flushed by then. Metadata runs early enough to set it correctly.
  if (!meal) notFound();
  return { title: `${meal.name} · Home Meal Planner` };
}

export default async function MealDetailPage({
  params,
}: PageProps<"/meals/[id]">) {
  const { id } = await params;
  const meal = await getMeal(id);
  if (!meal) notFound();

  const references = await mealReferences(id);
  const minutes = (meal.prepMins ?? 0) + (meal.cookMins ?? 0);

  return (
    <article className="flex flex-col gap-6">
      <MealImage
        mealId={meal.id}
        imageHash={meal.imageHash}
        name={meal.name}
        size="full"
        className="aspect-[16/9] w-full rounded-2xl border border-line"
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            {meal.name}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
            {minutes > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" />
                {meal.prepMins ? `${meal.prepMins} prep` : null}
                {meal.prepMins && meal.cookMins ? " + " : null}
                {meal.cookMins ? `${meal.cookMins} cook` : null} min
              </span>
            )}
            {meal.servings && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" />
                Serves {meal.servings}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <form action={togglePinMealAction.bind(null, meal.id, !meal.pinned)}>
            <Button type="submit" variant="ghost" size="sm">
              {meal.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              {meal.pinned ? "Unpin" : "Pin"}
            </Button>
          </form>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/meals/${meal.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <DeleteMeal
            name={meal.name}
            references={references}
            action={deleteMealAction.bind(null, meal.id)}
          />
        </div>
      </header>

      <section>
        <h3 className="mb-2 text-sm font-medium text-ink-muted">Ingredients</h3>
        {meal.ingredients.length === 0 ? (
          <p className="text-sm text-ink-faint">No ingredients listed.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {meal.ingredients.map((row) => (
              <li
                key={row.id}
                className="flex items-baseline justify-between gap-4 px-4 py-2.5"
              >
                <span className="text-ink">{row.name}</span>
                <span className="shrink-0 text-sm font-medium text-ink-muted tabular-nums">
                  {formatMeasure({ quantity: row.quantity, unit: row.unit })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {meal.steps.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium text-ink-muted">Steps</h3>
          <ol className="flex flex-col gap-3">
            {meal.steps.map((step, index) => (
              <li key={step.id} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-medium text-ink-muted">
                  {index + 1}
                </span>
                <p className="whitespace-pre-wrap text-ink">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="text-xs text-ink-faint">
        Added by {meal.createdByName ?? "a deleted user"}.
      </footer>
    </article>
  );
}

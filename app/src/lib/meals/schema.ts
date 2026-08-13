import { z } from "zod";

import { isUnit } from "../units";
import { normalizeTagNames } from "../tags/normalize";

/** Blank form fields arrive as "" — treat that as absent, not as zero. */
const optionalInt = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(1).max(max).optional(),
  );

export const ingredientSchema = z.object({
  quantity: z.coerce
    .number()
    .positive("Quantity must be greater than zero.")
    .max(100_000),
  unit: z.string().refine(isUnit, "Pick a unit."),
  name: z.string().trim().min(1, "Name the ingredient.").max(120),
});

export const mealInputSchema = z.object({
  name: z.string().trim().min(1, "Give the meal a name.").max(160),
  /** Display-only reference; deliberately excluded from shopping-list maths. */
  servings: optionalInt(100),
  prepMins: optionalInt(24 * 60),
  cookMins: optionalInt(24 * 60),
  ingredients: z.array(ingredientSchema).max(60, "That is a lot of ingredients."),
  steps: z
    .array(z.string().trim().min(1).max(2000))
    .max(50, "That is a lot of steps."),
  tags: z.preprocess(
    (v) => normalizeTagNames(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []),
    z.array(z.string()),
  ),
});

export type MealInput = z.infer<typeof mealInputSchema>;
export type IngredientInput = z.infer<typeof ingredientSchema>;

/**
 * Ingredient rows travel as a single JSON field rather than indexed form
 * inputs (`ingredients[0][name]`…), which keeps add/remove/reorder purely a
 * client-state concern and gives the server one thing to parse.
 */
export function parseMealForm(formData: FormData) {
  let ingredients: unknown = [];
  const raw = formData.get("ingredients");
  if (typeof raw === "string" && raw.trim() !== "") {
    try {
      ingredients = JSON.parse(raw);
    } catch {
      return {
        success: false as const,
        error: { formErrors: ["Could not read the ingredient list."], fieldErrors: {} },
      };
    }
  }

  const parsed = mealInputSchema.safeParse({
    name: formData.get("name"),
    servings: formData.get("servings"),
    prepMins: formData.get("prepMins"),
    cookMins: formData.get("cookMins"),
    ingredients,
    steps: formData.getAll("steps"),
    tags: formData.getAll("tags"),
  });

  if (!parsed.success) {
    return { success: false as const, error: z.flattenError(parsed.error) };
  }
  return { success: true as const, data: parsed.data };
}

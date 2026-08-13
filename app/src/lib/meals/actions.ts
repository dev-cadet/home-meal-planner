"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "../auth/dal";
import { getDb } from "../db/client";
import { meal, mealImage, mealIngredient, mealStep, mealTag } from "../db/schema";
import { ImageRejected, processMealImage } from "../images/process";
import { setMealPinned } from "../pins/write";
import { pruneOrphanedMealTags, writeMealTags } from "../tags/write";
import { parseMealForm, type IngredientInput } from "./schema";

export interface MealFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/** Replace a meal's ingredient rows wholesale — simpler than diffing, and the
 *  lists are tiny. Positions are reassigned from array order. */
async function writeIngredients(
  db: Awaited<ReturnType<typeof getDb>>,
  mealId: string,
  ingredients: IngredientInput[],
) {
  await db.delete(mealIngredient).where(eq(mealIngredient.mealId, mealId));
  if (ingredients.length === 0) return;

  await db.insert(mealIngredient).values(
    ingredients.map((row, position) => ({
      mealId,
      position,
      quantity: row.quantity,
      unit: row.unit,
      name: row.name,
    })),
  );
}

/** Replace a meal's step rows wholesale — same shape as `writeIngredients`.
 *  Positions are reassigned from array order. */
async function writeSteps(
  db: Awaited<ReturnType<typeof getDb>>,
  mealId: string,
  steps: string[],
) {
  await db.delete(mealStep).where(eq(mealStep.mealId, mealId));
  if (steps.length === 0) return;

  await db.insert(mealStep).values(
    steps.map((text, position) => ({ mealId, position, text })),
  );
}

/**
 * Process and store an uploaded image, returning its content hash.
 *
 * Returns undefined when no new file was supplied, which leaves any existing
 * image untouched.
 */
async function writeImage(
  db: Awaited<ReturnType<typeof getDb>>,
  mealId: string,
  file: File | null,
): Promise<string | undefined> {
  if (!file || file.size === 0) return undefined;

  const processed = await processMealImage(
    new Uint8Array(await file.arrayBuffer()),
  );

  const row = {
    mealId,
    full: processed.full,
    thumb: processed.thumb,
    mime: processed.mime,
    width: processed.width,
    height: processed.height,
    hash: processed.hash,
    updatedAt: new Date(),
  };

  await db
    .insert(mealImage)
    .values(row)
    .onConflictDoUpdate({ target: mealImage.mealId, set: row });

  return processed.hash;
}

function imageFileOf(formData: FormData): File | null {
  const value = formData.get("image");
  return value instanceof File ? value : null;
}

export async function createMealAction(
  _prev: MealFormState,
  formData: FormData,
): Promise<MealFormState> {
  const user = await requireUser();
  const parsed = parseMealForm(formData);
  if (!parsed.success) {
    return {
      error: parsed.error.formErrors[0],
      fieldErrors: parsed.error.fieldErrors as Record<string, string[]>,
    };
  }

  const db = await getDb();
  const { ingredients, steps, tags, ...fields } = parsed.data;

  let id: string;
  try {
    const [row] = await db
      .insert(meal)
      .values({ ...fields, createdById: user.id, updatedById: user.id })
      .returning({ id: meal.id });
    id = row!.id;

    await writeIngredients(db, id, ingredients);
    await writeSteps(db, id, steps);
    await writeMealTags(db, id, tags);

    const hash = await writeImage(db, id, imageFileOf(formData));
    if (hash) {
      await db.update(meal).set({ imageHash: hash }).where(eq(meal.id, id));
    }
  } catch (error) {
    if (error instanceof ImageRejected) {
      return { error: error.message, fieldErrors: { image: [error.message] } };
    }
    throw error;
  }

  revalidatePath("/meals");
  redirect(`/meals/${id}`);
}

export async function updateMealAction(
  mealId: string,
  _prev: MealFormState,
  formData: FormData,
): Promise<MealFormState> {
  const user = await requireUser();
  const parsed = parseMealForm(formData);
  if (!parsed.success) {
    return {
      error: parsed.error.formErrors[0],
      fieldErrors: parsed.error.fieldErrors as Record<string, string[]>,
    };
  }

  const db = await getDb();
  const { ingredients, steps, tags, ...fields } = parsed.data;

  try {
    const hash = await writeImage(db, mealId, imageFileOf(formData));

    await db
      .update(meal)
      .set({
        ...fields,
        // Left untouched when no new file was uploaded.
        ...(hash ? { imageHash: hash } : {}),
        updatedById: user.id,
      })
      .where(eq(meal.id, mealId));

    await writeIngredients(db, mealId, ingredients);
    await writeSteps(db, mealId, steps);
    await writeMealTags(db, mealId, tags);
  } catch (error) {
    if (error instanceof ImageRejected) {
      return { error: error.message, fieldErrors: { image: [error.message] } };
    }
    throw error;
  }

  revalidatePath("/meals");
  revalidatePath(`/meals/${mealId}`);
  redirect(`/meals/${mealId}`);
}

export async function deleteMealAction(mealId: string): Promise<void> {
  await requireUser();
  const db = await getDb();

  const tags = await db
    .select({ tagId: mealTag.tagId })
    .from(mealTag)
    .where(eq(mealTag.mealId, mealId));

  // Ingredients, the image, plan items, schedule entries and tag
  // associations all cascade.
  await db.delete(meal).where(eq(meal.id, mealId));

  await pruneOrphanedMealTags(db, tags.map((t) => t.tagId));

  revalidatePath("/meals");
  redirect("/meals");
}

/** Pins or unpins a meal for the current user only — shared content, per-user opinion. */
export async function togglePinMealAction(mealId: string, pinned: boolean): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  await setMealPinned(db, user.id, mealId, pinned);

  revalidatePath("/meals");
  revalidatePath(`/meals/${mealId}`);
}

/** Drop a meal's image without touching the rest of it. */
export async function removeMealImageAction(mealId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  await db.delete(mealImage).where(eq(mealImage.mealId, mealId));
  await db
    .update(meal)
    .set({ imageHash: null, updatedById: user.id })
    .where(eq(meal.id, mealId));

  revalidatePath(`/meals/${mealId}`);
  redirect(`/meals/${mealId}/edit`);
}

"use client";

import { ChevronDown, ChevronUp, ImageUp, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";

import { mealImageUrl } from "@/components/meals/meal-image";
import { StepsField } from "@/components/meals/steps-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/cn";
import { compressImage } from "@/lib/images/compress-client";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES } from "@/lib/images/limits";
import type { MealFormState } from "@/lib/meals/actions";
import { UNITS } from "@/lib/units";

interface Row {
  key: string;
  quantity: string;
  unit: string;
  name: string;
}

export interface MealFormValues {
  id?: string;
  name: string;
  servings: string;
  prepMins: string;
  cookMins: string;
  imageHash: string | null;
  ingredients: { quantity: number; unit: string; name: string }[];
  steps: string[];
  tags: string[];
}

/**
 * A React list key, not a real identifier — so it doesn't need
 * `crypto.randomUUID()`, which only exists in a secure context. Testing over
 * plain HTTP on a phone's LAN IP is not secure by that definition, and the
 * whole form crashed on mount because of it.
 */
let rowKeySeq = 0;
function nextRowKey(): string {
  return `row-${Date.now().toString(36)}-${(rowKeySeq++).toString(36)}`;
}

const newRow = (): Row => ({
  key: nextRowKey(),
  quantity: "",
  unit: "g",
  name: "",
});

export function MealForm({
  action,
  values,
  submitLabel,
  defaultUnit,
  tagSuggestions,
  recentTags,
}: {
  action: (state: MealFormState, formData: FormData) => Promise<MealFormState>;
  values: MealFormValues;
  submitLabel: string;
  defaultUnit: string;
  tagSuggestions: string[];
  recentTags: string[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formId = useId();

  const [rows, setRows] = useState<Row[]>(() =>
    values.ingredients.length
      ? values.ingredients.map((i) => ({
          key: nextRowKey(),
          quantity: String(i.quantity),
          unit: i.unit,
          name: i.name,
        }))
      : [{ ...newRow(), unit: defaultUnit }],
  );

  const [preview, setPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Object URLs leak until revoked.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImageError(null);
    if (preview) URL.revokeObjectURL(preview);

    if (!file) {
      setPreview(null);
      return;
    }

    if (file.size <= MAX_UPLOAD_BYTES) {
      setPreview(URL.createObjectURL(file));
      return;
    }

    setCompressing(true);
    try {
      const compressed = await compressImage(file, MAX_UPLOAD_BYTES);

      if (compressed.size > MAX_UPLOAD_BYTES) {
        // Rare — even the smallest quality step didn't fit. A hard cap
        // stays server-side too; this just gives the reason sooner.
        setImageError(
          `Even compressed, that image is ${(compressed.size / 1024 / 1024).toFixed(1)}MB. Try a smaller photo.`,
        );
        setPreview(null);
        event.target.value = "";
        return;
      }

      // Replace the input's file with the compressed one via DataTransfer,
      // so the existing multipart submit path needs no changes — the form
      // still just reads whatever File sits in this input.
      const transfer = new DataTransfer();
      transfer.items.add(compressed);
      if (fileRef.current) fileRef.current.files = transfer.files;

      setPreview(URL.createObjectURL(compressed));
    } catch {
      // This browser can't compress it (no createImageBitmap, an
      // undecodable format such as HEIC, or no WebP encoder). The original
      // is still oversized, so say so now rather than uploading it to fail
      // the same check server-side.
      setImageError(
        `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 2MB — this browser can't compress it automatically, so try resizing it first.`,
      );
      setPreview(null);
      event.target.value = "";
    } finally {
      setCompressing(false);
    }
  }

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const move = (index: number, delta: number) =>
    setRows((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  // Rows travel as one JSON field; blank rows are dropped rather than rejected.
  const ingredientsJson = JSON.stringify(
    rows
      .filter((r) => r.name.trim() !== "" || r.quantity.trim() !== "")
      .map((r) => ({ quantity: r.quantity, unit: r.unit, name: r.name })),
  );

  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0];
  const existingImage =
    values.id && values.imageHash
      ? mealImageUrl(values.id, values.imageHash, "full")
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="ingredients" value={ingredientsJson} />

      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <Field
        label="Name"
        htmlFor={`${formId}-name`}
        error={fieldError("name")}
      >
        <Input
          id={`${formId}-name`}
          name="name"
          defaultValue={values.name}
          placeholder="Thai green curry"
          required
          autoFocus={!values.id}
        />
      </Field>

      {/* Image ---------------------------------------------------------- */}
      <Field
        label="Photo"
        hint="Large photos are compressed automatically. Location data is always stripped."
        error={imageError ?? fieldError("image")}
      >
        <div className="flex items-start gap-3">
          {(preview ?? existingImage) && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview ?? existingImage!}
                alt=""
                className="size-24 rounded-xl border border-line object-cover"
              />
              {preview && (
                <button
                  type="button"
                  aria-label="Remove selected image"
                  onClick={() => {
                    URL.revokeObjectURL(preview);
                    setPreview(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="absolute -top-2 -right-2 inline-flex size-6 items-center justify-center rounded-full bg-ink text-canvas"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          <label
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors",
              compressing
                ? "cursor-wait opacity-70"
                : "cursor-pointer hover:bg-surface-muted",
            )}
          >
            <ImageUp className="size-4" />
            {compressing
              ? "Compressing…"
              : existingImage && !preview
                ? "Replace photo"
                : "Choose photo"}
            <input
              ref={fileRef}
              type="file"
              name="image"
              accept={ACCEPT_ATTRIBUTE}
              onChange={onPickImage}
              disabled={compressing}
              className="sr-only"
            />
          </label>
        </div>
      </Field>

      <Field label="Tags" hint="Press Enter or comma to add one.">
        <TagInput
          name="tags"
          initialTags={values.tags}
          suggestions={tagSuggestions}
          recentTags={recentTags}
        />
      </Field>

      {/* Ingredients ---------------------------------------------------- */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink">
          Ingredients
        </legend>
        {fieldError("ingredients") && (
          <p role="alert" className="text-xs text-danger">
            {fieldError("ingredients")}
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li key={row.key} className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Quantity"
                inputMode="decimal"
                value={row.quantity}
                onChange={(e) => update(row.key, { quantity: e.target.value })}
                placeholder="200"
                className="w-20 shrink-0"
              />

              <Select
                aria-label="Unit"
                value={row.unit}
                onChange={(e) => update(row.key, { unit: e.target.value })}
                className="w-24 shrink-0"
              >
                {UNITS.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.label}
                  </option>
                ))}
              </Select>

              <Input
                aria-label="Ingredient"
                value={row.name}
                onChange={(e) => update(row.key, { name: e.target.value })}
                placeholder="green beans"
                className="min-w-0 flex-1"
              />

              {/* Own line on narrow screens, same reasoning as PlanMeals: three
                  44px touch targets plus the inputs above don't fit one row. */}
              <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                <button
                  type="button"
                  aria-label={`Move ${row.name || "row"} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-surface-muted hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronUp className="size-4" />
                </button>

                <button
                  type="button"
                  aria-label={`Move ${row.name || "row"} down`}
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-surface-muted hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronDown className="size-4" />
                </button>

                <button
                  type="button"
                  aria-label={`Remove ${row.name || "row"}`}
                  onClick={() =>
                    setRows((prev) =>
                      prev.length === 1
                        ? [{ ...newRow(), unit: defaultUnit }]
                        : prev.filter((r) => r.key !== row.key),
                    )
                  }
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() =>
            setRows((prev) => [...prev, { ...newRow(), unit: defaultUnit }])
          }
        >
          <Plus className="size-4" />
          Add ingredient
        </Button>
      </fieldset>

      {/* Details -------------------------------------------------------- */}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Serves" htmlFor={`${formId}-servings`} error={fieldError("servings")}>
          <Input
            id={`${formId}-servings`}
            name="servings"
            inputMode="numeric"
            defaultValue={values.servings}
            placeholder="4"
          />
        </Field>
        <Field label="Prep (min)" htmlFor={`${formId}-prep`} error={fieldError("prepMins")}>
          <Input
            id={`${formId}-prep`}
            name="prepMins"
            inputMode="numeric"
            defaultValue={values.prepMins}
            placeholder="15"
          />
        </Field>
        <Field label="Cook (min)" htmlFor={`${formId}-cook`} error={fieldError("cookMins")}>
          <Input
            id={`${formId}-cook`}
            name="cookMins"
            inputMode="numeric"
            defaultValue={values.cookMins}
            placeholder="25"
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink">Steps</legend>
        {fieldError("steps") && (
          <p role="alert" className="text-xs text-danger">
            {fieldError("steps")}
          </p>
        )}
        <StepsField name="steps" initialSteps={values.steps} />
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button asChild variant="ghost">
          <Link href={values.id ? `/meals/${values.id}` : "/meals"}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

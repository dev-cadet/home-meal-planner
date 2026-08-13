import { ListMusic } from "lucide-react";

import { MealImage } from "@/components/meals/meal-image";
import { cn } from "@/lib/cn";
import { hueOf } from "@/lib/hue";
import type { PlanCoverImage } from "@/lib/plans/queries";

/**
 * A plan's cover: a photo collage from up to 6 of its meals' photos, laid
 * out differently depending on how many there are. Meals without a photo
 * never take a slot — a 3-meal plan where only 1 meal has a picture gets the
 * 1-image layout, not three tiles with two placeholders.
 *
 * On the mobile card this cover has no height of its own — it stretches to
 * match whatever the text column next to it needs (align-items: stretch).
 * That only works if the cover's own content can't push back with an
 * opinion about its height. Thumbnails are exactly square (400x400,
 * confirmed against real files, not assumed), so an unconstrained tile
 * spanning the full column width — the bottom tile in the 3-image layout,
 * say — naturally wants to be exactly that wide *and that tall*, which is
 * often taller than the stretched box actually available. Measured this
 * directly: a 113px-wide 3-image cover next to three lines of text came out
 * 171px tall, driven entirely by the images, not the text.
 *
 * Each tile's `<img>` is `absolute inset-0` inside a `relative` box instead
 * of a normal `h-full w-full` child. An absolutely positioned element is
 * removed from flow, so it has no intrinsic size to contribute — the tile
 * box is sized purely by flex distribution from its stretched ancestor, and
 * the image just fills whatever box that turns out to be.
 */
export function PlanCover({
  images,
  name,
  className,
}: {
  images: PlanCoverImage[];
  name: string;
  className?: string;
}) {
  if (images.length === 0) {
    const hue = hueOf(name);
    return (
      <div
        aria-hidden
        className={cn("flex items-center justify-center bg-surface-muted", className)}
        style={{
          backgroundColor: `oklch(0.88 0.06 ${hue})`,
          color: `oklch(0.45 0.11 ${hue})`,
        }}
      >
        <ListMusic className="size-8 opacity-70" />
      </div>
    );
  }

  const tile = (image: PlanCoverImage, extra?: string) => (
    <div key={image.mealId} className={cn("relative min-h-0 min-w-0 flex-1", extra)}>
      <MealImage
        mealId={image.mealId}
        imageHash={image.imageHash}
        name={image.name}
        size="thumb"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );

  if (images.length === 1) {
    return <div className={cn("flex overflow-hidden", className)}>{tile(images[0]!)}</div>;
  }

  if (images.length === 2) {
    return (
      <div className={cn("flex overflow-hidden", className)}>
        {tile(images[0]!)}
        {tile(images[1]!, "border-l border-canvas")}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div className={cn("flex flex-col overflow-hidden", className)}>
        <div className="flex min-h-0 flex-1">
          {tile(images[0]!)}
          {tile(images[1]!, "border-l border-canvas")}
        </div>
        <div className="flex min-h-0 flex-1 border-t border-canvas">{tile(images[2]!)}</div>
      </div>
    );
  }

  if (images.length === 4) {
    return (
      <div className={cn("flex flex-col overflow-hidden", className)}>
        <div className="flex min-h-0 flex-1">
          {tile(images[0]!)}
          {tile(images[1]!, "border-l border-canvas")}
        </div>
        <div className="flex min-h-0 flex-1 border-t border-canvas">
          {tile(images[2]!)}
          {tile(images[3]!, "border-l border-canvas")}
        </div>
      </div>
    );
  }

  if (images.length === 5) {
    return (
      <div className={cn("flex flex-col overflow-hidden", className)}>
        <div className="flex min-h-0 flex-1">
          {images.slice(0, 3).map((image, i) => tile(image, i > 0 ? "border-l border-canvas" : undefined))}
        </div>
        <div className="flex min-h-0 flex-1 border-t border-canvas">
          {images.slice(3, 5).map((image, i) => tile(image, i > 0 ? "border-l border-canvas" : undefined))}
        </div>
      </div>
    );
  }

  // 6 — a full 3x2 grid.
  return (
    <div className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex min-h-0 flex-1">
        {images.slice(0, 3).map((image, i) => tile(image, i > 0 ? "border-l border-canvas" : undefined))}
      </div>
      <div className="flex min-h-0 flex-1 border-t border-canvas">
        {images.slice(3, 6).map((image, i) => tile(image, i > 0 ? "border-l border-canvas" : undefined))}
      </div>
    </div>
  );
}

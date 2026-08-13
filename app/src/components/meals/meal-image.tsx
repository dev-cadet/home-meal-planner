import { CookingPot } from "lucide-react";

import { cn } from "@/lib/cn";
import { hueOf } from "@/lib/hue";

export function mealImageUrl(
  mealId: string,
  hash: string,
  size: "full" | "thumb",
): string {
  // The hash in the query string is what makes the response cacheable forever.
  return `/api/meals/${mealId}/image?size=${size}&v=${hash}`;
}

/**
 * A meal's picture, or a coloured placeholder.
 *
 * Deliberately a plain <img> rather than next/image: these bytes are already
 * resized and WebP-encoded by our own pipeline and served with an immutable
 * content-hash URL, so routing them through the image optimiser would add work
 * and a second cache layer for no gain.
 */
export function MealImage({
  mealId,
  imageHash,
  name,
  size = "thumb",
  className,
}: {
  mealId: string;
  imageHash: string | null;
  name: string;
  size?: "full" | "thumb";
  className?: string;
}) {
  if (!imageHash) {
    const hue = hueOf(name);
    return (
      <div
        aria-hidden
        className={cn(
          "flex items-center justify-center bg-surface-muted",
          className,
        )}
        style={{
          backgroundColor: `oklch(0.88 0.06 ${hue})`,
          color: `oklch(0.45 0.11 ${hue})`,
        }}
      >
        <CookingPot className="size-8 opacity-70" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- see note above
    <img
      src={mealImageUrl(mealId, imageHash, size)}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("object-cover", className)}
    />
  );
}

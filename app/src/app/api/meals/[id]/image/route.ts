import { getMealImage } from "@/lib/meals/queries";

/**
 * Serve a meal image from SQLite.
 *
 * The URL carries the content hash as `?v=`, so it changes only when the image
 * does. That lets the response be marked `immutable` with a one-year lifetime:
 * the browser fetches each image exactly once and never revalidates. Editing
 * an image changes its hash, hence its URL, which busts the cache for free.
 *
 * This is why the Redis idea in §10 was dropped — no server-side cache can
 * beat a request the browser never makes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const size =
    new URL(request.url).searchParams.get("size") === "thumb" ? "thumb" : "full";

  // getMealImage calls requireUser(); images are not public.
  const image = await getMealImage(id, size);
  if (!image?.bytes) {
    return new Response("Not found", { status: 404 });
  }

  const etag = `"${image.hash}-${size}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const body = image.bytes as Buffer;

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(body.byteLength),
      ETag: etag,
      // `private`: responses are per-user authenticated, so shared caches
      // must not store them. The browser cache still applies.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

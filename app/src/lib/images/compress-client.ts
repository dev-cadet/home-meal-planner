/**
 * Client-side compression, so a phone photo over the upload cap gets smaller
 * instead of just bouncing off it.
 *
 * A courtesy, not a control: the server re-encodes and re-validates
 * everything independently (lib/images/process.ts), so nothing here needs to
 * be trusted. Built entirely from `createImageBitmap` and `<canvas>` — no
 * image library shipped to the browser for what is, in practice, almost
 * always solved by a single resize.
 *
 * Browser-only. Never import this from server code — that is what
 * `./limits` is for.
 */

import { TARGET_EDGE } from "./limits";

const START_QUALITY = 0.82;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.1;

/**
 * Re-encode `file` as WebP, downscaled to `TARGET_EDGE` and stepping quality
 * down until it fits under `targetBytes` — or throws if this browser can't
 * do that (no `createImageBitmap`, an undecodable format such as HEIC, or no
 * WebP encoder in `canvas.toBlob`, which is true of Safari before 14).
 *
 * Callers should catch the failure and fall back to the original file: the
 * server's own cap is the real check, this is only trying to avoid a
 * pointless rejected upload.
 */
export async function compressImage(file: File, targetBytes: number): Promise<File> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("createImageBitmap is unavailable in this browser");
  }

  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the file's EXIF orientation during decode, so the
    // canvas — which has no EXIF concept of its own — draws it upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("could not decode this image in the browser");
  }

  const scale = Math.min(1, TARGET_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("2D canvas is unavailable in this browser");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));

  let blob: Blob | null = null;
  for (let quality = START_QUALITY; quality >= MIN_QUALITY; quality -= QUALITY_STEP) {
    blob = await toBlob(quality);
    // Resizing alone usually does the job — a phone photo's file size comes
    // mostly from pixel count, not encoding quality — so this loop rarely
    // runs more than once.
    if (blob && blob.size <= targetBytes) break;
  }

  // Resolves null rather than throwing when the browser has no WebP encoder.
  if (!blob) {
    throw new Error("this browser could not encode WebP");
  }

  const name = file.name.replace(/\.\w+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
}

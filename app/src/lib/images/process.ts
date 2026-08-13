import { createHash } from "node:crypto";

import sharp, { type OutputInfo } from "sharp";

import { MAX_UPLOAD_BYTES, TARGET_EDGE } from "./limits";

/**
 * Meal image pipeline (docs/plan.md §5).
 *
 * Uploads arrive as multipart form data, are re-encoded server-side, and are
 * stored as raw BLOBs in SQLite — never base64, which would inflate every
 * image by a third for no benefit.
 *
 * Server-only: importing this from a Client Component pulls sharp's native
 * binary into the browser bundle. Shared constants live in `./limits`.
 */

export { MAX_UPLOAD_BYTES };

const THUMB_EDGE = 400;
const FULL_QUALITY = 80;
const THUMB_QUALITY = 70;

export const OUTPUT_MIME = "image/webp";

export interface ProcessedImage {
  full: Buffer;
  thumb: Buffer;
  mime: string;
  width: number;
  height: number;
  hash: string;
}

export type ImageError =
  | "too_large"
  | "empty"
  | "unsupported_type"
  | "corrupt";

export class ImageRejected extends Error {
  constructor(
    readonly reason: ImageError,
    message: string,
  ) {
    super(message);
    this.name = "ImageRejected";
  }
}

/**
 * Detect the real format from the leading bytes.
 *
 * The browser-supplied MIME type and file extension are attacker-controlled,
 * so neither is trusted. Only formats we can actually decode are accepted.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const startsWith = (...sig: number[]) =>
    sig.every((byte, i) => bytes[i] === byte);

  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return "image/png";
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return "image/gif";

  // RIFF....WEBP
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  // ISO-BMFF 'ftyp' box with an AVIF brand
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(...Array.from(bytes.slice(8, 12)));
    if (brand === "avif" || brand === "avis") return "image/avif";
  }

  return null;
}

/**
 * Validate, normalise and re-encode an uploaded image.
 *
 * Two details matter beyond resizing:
 *
 *  - `rotate()` with no argument applies the EXIF orientation tag, without
 *    which phone photos land sideways.
 *  - Re-encoding through sharp drops all metadata unless explicitly kept. That
 *    strips **GPS coordinates**, which phone cameras embed and which would
 *    otherwise publish the location of your kitchen to everyone in a shared,
 *    wiki-editable app.
 */
export async function processMealImage(
  input: Uint8Array,
): Promise<ProcessedImage> {
  if (input.byteLength === 0) {
    throw new ImageRejected("empty", "That file is empty.");
  }
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageRejected(
      "too_large",
      `Images must be 2MB or smaller (that one is ${(input.byteLength / 1024 / 1024).toFixed(1)}MB).`,
    );
  }

  const sniffed = sniffImageType(input);
  if (!sniffed) {
    throw new ImageRejected(
      "unsupported_type",
      "That does not look like a JPEG, PNG, WebP, GIF or AVIF image.",
    );
  }

  const source = Buffer.from(input);

  let full: Buffer;
  let info: OutputInfo;
  try {
    const result = await sharp(source)
      .rotate() // apply EXIF orientation, then discard it
      .resize(TARGET_EDGE, TARGET_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: FULL_QUALITY })
      .toBuffer({ resolveWithObject: true });

    full = result.data;
    info = result.info;
  } catch {
    throw new ImageRejected("corrupt", "That image could not be read.");
  }

  const thumb = await sharp(source)
    .rotate()
    .resize(THUMB_EDGE, THUMB_EDGE, { fit: "cover", position: "centre" })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();

  return {
    full,
    thumb,
    mime: OUTPUT_MIME,
    width: info.width,
    height: info.height,
    // Content hash drives the immutable image URL, so editing an image
    // changes its URL and busts every cached copy automatically.
    hash: createHash("sha256").update(full).digest("hex").slice(0, 16),
  };
}

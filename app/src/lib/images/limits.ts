/**
 * Image constants shared by the browser and the server.
 *
 * Deliberately free of any sharp import: `process.ts` pulls in a native Node
 * binary, so a Client Component importing from it would drag sharp into the
 * browser bundle and fail the build.
 */

/**
 * Upload cap. What lands in the database is roughly a tenth of this.
 *
 * Also the target the client-side compressor (./compress-client) aims under
 * before a file ever reaches the network — this is the one number both sides
 * agree on, so a photo that fits here never gets rejected server-side for
 * being oversized.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * The long edge both the client compressor and the server's own resize
 * (lib/images/process.ts) target. Shared so neither side sends more pixels
 * than the other keeps — the server downsizes to this regardless of what
 * arrives, so compressing any larger client-side only costs upload time for
 * no gain in the final image.
 */
export const TARGET_EDGE = 1200;

/** Accepted for upload; everything is re-encoded to WebP on the server. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",");

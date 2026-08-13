import { describe, expect, it } from "bun:test";
import sharp, { type Exif } from "sharp";

import {
  ImageRejected,
  MAX_UPLOAD_BYTES,
  processMealImage,
  sniffImageType,
} from "./process";

/**
 * A photo-like JPEG. Pure noise compresses far worse than any real photograph
 * (6MB at 3000x2000), so it is blurred first to give the gradients a camera
 * image actually has. Lands around 1.25MB — a realistic phone photo.
 */
async function photoJpeg(width: number, height: number, quality = 90) {
  const pixels = Buffer.allocUnsafe(width * height * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = Math.floor(Math.random() * 256);
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .blur(2)
    .jpeg({ quality })
    .toBuffer();
}

async function flatJpeg(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 60 } },
  })
    .jpeg()
    .toBuffer();
}

describe("sniffImageType", () => {
  it("identifies real formats from their leading bytes", async () => {
    const jpeg = await flatJpeg(8, 8);
    const png = await sharp(jpeg).png().toBuffer();
    const webp = await sharp(jpeg).webp().toBuffer();

    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("returns null for non-images", () => {
    expect(sniffImageType(new TextEncoder().encode("#!/bin/sh\nrm -rf /"))).toBeNull();
    expect(sniffImageType(new Uint8Array([0, 1, 2, 3]))).toBeNull();
  });

  /**
   * The declared MIME type and filename are attacker-controlled, so content
   * sniffing is the only trustworthy check.
   */
  it("is not fooled by a script claiming to be a JPEG", () => {
    const payload = new TextEncoder().encode("<?php system($_GET['c']); ?>");
    expect(sniffImageType(payload)).toBeNull();
  });
});

describe("rejections", () => {
  it("rejects an empty file", async () => {
    await expect(processMealImage(new Uint8Array())).rejects.toBeInstanceOf(
      ImageRejected,
    );
  });

  it("rejects anything over 2MB", async () => {
    const oversized = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    oversized.set([0xff, 0xd8, 0xff]);

    const error = await processMealImage(oversized).catch((e) => e);
    expect(error).toBeInstanceOf(ImageRejected);
    expect(error.reason).toBe("too_large");
    expect(error.message).toMatch(/2MB/);
  });

  it("rejects a non-image", async () => {
    const error = await processMealImage(
      new TextEncoder().encode("not an image at all"),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ImageRejected);
    expect(error.reason).toBe("unsupported_type");
  });

  it("rejects a truncated image that sniffs correctly", async () => {
    const jpeg = await flatJpeg(64, 64);
    const truncated = jpeg.subarray(0, 20); // valid header, no body

    const error = await processMealImage(truncated).catch((e) => e);
    expect(error).toBeInstanceOf(ImageRejected);
    expect(error.reason).toBe("corrupt");
  });
});

describe("processing", () => {
  it("re-encodes to WebP and caps the long edge at 1200", async () => {
    const source = await flatJpeg(3000, 2000);
    const result = await processMealImage(source);

    expect(result.mime).toBe("image/webp");
    expect(sniffImageType(result.full)).toBe("image/webp");
    expect(Math.max(result.width, result.height)).toBe(1200);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(800);
  });

  it("produces a square 400px thumbnail", async () => {
    const source = await flatJpeg(3000, 2000);
    const { thumb } = await processMealImage(source);
    const meta = await sharp(thumb).metadata();

    expect(meta.width).toBe(400);
    expect(meta.height).toBe(400);
    expect(meta.format).toBe("webp");
  });

  it("leaves images smaller than the cap alone rather than upscaling", async () => {
    const source = await flatJpeg(300, 200);
    const result = await processMealImage(source);

    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
  });

  /**
   * Phone photos carry an orientation tag rather than rotated pixels. Without
   * applying it, every portrait photo lands sideways.
   */
  it("applies EXIF orientation instead of trusting pixel order", async () => {
    const landscape = await flatJpeg(1600, 900);
    const tagged = await sharp(landscape)
      .withMetadata({ orientation: 6 }) // 90° clockwise
      .jpeg()
      .toBuffer();

    const result = await processMealImage(tagged);

    // 1600x900 rotated becomes portrait, then fits inside 1200.
    expect(result.height).toBeGreaterThan(result.width);
    expect(result.height).toBe(1200);
    expect(result.width).toBe(675);
  });

  /**
   * The privacy requirement: phone cameras embed GPS coordinates, and this is
   * a shared app where anyone can open anyone's recipe.
   */
  it("strips all EXIF metadata, including GPS", async () => {
    const base = await flatJpeg(1200, 800);
    const withGps = await sharp(base)
      // sharp writes a GPS IFD at runtime, but its Exif type only declares
      // IFD0/1/2/3 — hence the cast. Asserted below, not assumed.
      .withExif({
        IFD0: { Make: "TestPhone", Model: "SecretModel" },
        GPS: {
          GPSLatitudeRef: "N",
          GPSLatitude: "51/1 30/1 0/1",
          GPSLongitudeRef: "W",
          GPSLongitude: "0/1 7/1 0/1",
        },
      } as unknown as Exif)
      .jpeg()
      .toBuffer();

    // The fixture really does carry the data we claim to remove.
    const before = await sharp(withGps).metadata();
    expect(before.exif).toBeDefined();
    expect(withGps.includes(Buffer.from("TestPhone"))).toBe(true);

    const result = await processMealImage(withGps);
    const after = await sharp(result.full).metadata();

    expect(after.exif).toBeUndefined();
    // Belt and braces: the raw bytes carry no trace either.
    expect(result.full.includes(Buffer.from("TestPhone"))).toBe(false);
    expect(result.full.includes(Buffer.from("SecretModel"))).toBe(false);
    expect(result.full.includes(Buffer.from("GPS"))).toBe(false);
    expect(result.thumb.includes(Buffer.from("TestPhone"))).toBe(false);
  });

  /** The 2MB cap is an upload limit; stored size should be far smaller. */
  it("crunches a 2MB photo to well under 250KB", async () => {
    const source = await photoJpeg(3000, 2000);
    // Generated content varies, so assert the fixture is genuinely in the
    // range this test claims to cover before trusting the result.
    expect(source.byteLength).toBeGreaterThan(800_000);
    expect(source.byteLength).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);

    const result = await processMealImage(source);

    expect(result.full.byteLength).toBeLessThan(250 * 1024);
    expect(result.thumb.byteLength).toBeLessThan(60 * 1024);
    expect(result.full.byteLength).toBeLessThan(source.byteLength / 4);
  });
});

describe("content hash", () => {
  it("is stable for identical input", async () => {
    const source = await flatJpeg(400, 300);
    const a = await processMealImage(source);
    const b = await processMealImage(source);

    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes when the image changes", async () => {
    const a = await processMealImage(await flatJpeg(400, 300));
    const b = await processMealImage(
      await sharp({
        create: {
          width: 400,
          height: 300,
          channels: 3,
          background: { r: 10, g: 200, b: 90 },
        },
      })
        .jpeg()
        .toBuffer(),
    );

    expect(a.hash).not.toBe(b.hash);
  });
});

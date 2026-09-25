import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { detectImageType, readVerifiedImage } from "./image-signature";

const asFile = (buffer: Buffer, type: string) => new File([new Uint8Array(buffer)], "upload", { type });
const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#2e7d32" } });

describe("readVerifiedImage", () => {
  it("accepts a real image of each allowed format and keeps the format", async () => {
    for (const [format, type] of [
      ["jpeg", "image/jpeg"],
      ["png", "image/png"],
      ["webp", "image/webp"],
    ] as const) {
      const bytes = await solid(4, 4).toFormat(format).toBuffer();
      const image = await readVerifiedImage(asFile(bytes, type));
      expect(image?.type).toBe(type);
      expect((await sharp(image!.buffer).metadata()).format).toBe(format);
    }
  });

  it("rejects bytes that only start with a valid signature", async () => {
    expect(await readVerifiedImage(asFile(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg"))).toBeNull();
    expect(
      await readVerifiedImage(asFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")),
    ).toBeNull();
  });

  it("rejects a truncated image", async () => {
    const full = await solid(64, 64).jpeg().toBuffer();
    expect(await readVerifiedImage(asFile(full.subarray(0, full.length / 2), "image/jpeg"))).toBeNull();
  });

  it("strips metadata such as EXIF (phone GPS location)", async () => {
    const withExif = await solid(8, 8)
      .jpeg()
      .withExif({ IFD0: { Copyright: "secret owner", Artist: "someone" } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const image = await readVerifiedImage(asFile(withExif, "image/jpeg"));
    expect((await sharp(image!.buffer).metadata()).exif).toBeUndefined();
  });

  it("caps the longest side at 2000 px without enlarging small images", async () => {
    const big = await readVerifiedImage(asFile(await solid(3000, 1500).png().toBuffer(), "image/png"));
    const bigMeta = await sharp(big!.buffer).metadata();
    expect([bigMeta.width, bigMeta.height]).toEqual([2000, 1000]);

    const small = await readVerifiedImage(asFile(await solid(40, 20).png().toBuffer(), "image/png"));
    const smallMeta = await sharp(small!.buffer).metadata();
    expect([smallMeta.width, smallMeta.height]).toEqual([40, 20]);
  });
});

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

describe("detectImageType", () => {
  it("detects JPEG", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe("image/jpeg");
  });

  it("detects PNG", () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe("image/png");
  });

  it("detects WebP", () => {
    expect(detectImageType(bytes(...ascii("RIFF"), 0x24, 0x00, 0x00, 0x00, ...ascii("WEBPVP8 ")))).toBe(
      "image/webp",
    );
  });

  it("rejects an HTML file even when it would be sent as image/png", () => {
    expect(detectImageType(bytes(...ascii("<html><script>alert(1)</script>")))).toBeNull();
  });

  it("rejects a RIFF file that isn't WebP (e.g. WAV)", () => {
    expect(detectImageType(bytes(...ascii("RIFF"), 0x24, 0x00, 0x00, 0x00, ...ascii("WAVE")))).toBeNull();
  });

  it("rejects empty and truncated input", () => {
    expect(detectImageType(bytes())).toBeNull();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
  });
});

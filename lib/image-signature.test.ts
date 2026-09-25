import { describe, expect, it } from "vitest";

import { detectImageType } from "./image-signature";

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

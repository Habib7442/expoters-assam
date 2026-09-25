import "server-only";

import sharp from "sharp";

export type AllowedImageType = "image/jpeg" | "image/png" | "image/webp";

export const IMAGE_EXTENSIONS: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Identifies an image by its leading "magic bytes", not by the MIME type the
 * browser sent. `File.type` is whatever the client claims, so an HTML or
 * script file renamed to .png would pass a `file.type` check; the bytes
 * can't be faked that way. Returns null for anything that isn't a JPEG, PNG,
 * or WebP.
 */
export function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((byte, i) => bytes[i] === byte)) {
    return "image/png";
  }

  // "RIFF" <4-byte size> "WEBP"
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }

  return null;
}

export type VerifiedImage = { buffer: Buffer; type: AllowedImageType; ext: string };

/** Longest side, in pixels, of any stored upload. */
const MAX_DIMENSION = 2000;
/** Refuse to decode anything bigger (a "decompression bomb": tiny file, huge pixel count). */
const MAX_INPUT_PIXELS = 40_000_000;

/**
 * Reads an uploaded file and returns it only if it really is an allowed
 * image. Two gates: the magic bytes must match (cheap, rejects obvious
 * non images before any decoding), then sharp must fully decode it
 * (rejects truncated or corrupt files that merely start right).
 *
 * The stored bytes are always sharp's re-encode, never the original: that
 * drops all metadata (EXIF, including phone GPS location, a DPDP privacy
 * concern for supplier photos), applies the EXIF rotation first so photos
 * aren't stored sideways, and caps the size at MAX_DIMENSION. The format is
 * kept (JPEG stays JPEG, and so on); animated WebP keeps its first frame.
 */
export async function readVerifiedImage(file: File): Promise<VerifiedImage | null> {
  const original = Buffer.from(await file.arrayBuffer());
  const type = detectImageType(original);
  if (!type) return null;

  try {
    const pipeline = sharp(original, { failOn: "warning", limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true });

    const encoded =
      type === "image/jpeg"
        ? pipeline.jpeg({ quality: 85, mozjpeg: true })
        : type === "image/png"
          ? pipeline.png({ compressionLevel: 9 })
          : pipeline.webp({ quality: 85 });

    const buffer = await encoded.toBuffer();
    return { buffer, type, ext: IMAGE_EXTENSIONS[type] };
  } catch {
    return null;
  }
}

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

/** Reads an uploaded file and returns it only if its bytes really are an allowed image. */
export async function readVerifiedImage(file: File): Promise<VerifiedImage | null> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = detectImageType(buffer);
  return type ? { buffer, type, ext: IMAGE_EXTENSIONS[type] } : null;
}

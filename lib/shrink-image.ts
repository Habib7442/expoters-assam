/**
 * Browser-only. Scales a photo down before it is sent to a server action, so
 * a few ordinary phone photos (3 to 5 MB each) fit under the server action
 * body limit (`next.config.ts`, kept under Vercel's 4.5 MB request cap).
 * The server still checks and decodes every image itself
 * (`lib/image-signature.ts`); this only makes the upload small enough to
 * arrive.
 *
 * Returns the original file when it is already small, or when the browser
 * can't decode it (the server then rejects it with a proper field error).
 */
export async function shrinkImage(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  if (file.size <= 600 * 1024) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // JPEG, not WebP: every browser can encode it (Safari's canvas can't
  // encode WebP), and product photos don't need transparency.
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

/** Total request budget for one product submission's images, under the server action limit. */
export const MAX_TOTAL_UPLOAD_BYTES = 3.5 * 1024 * 1024;

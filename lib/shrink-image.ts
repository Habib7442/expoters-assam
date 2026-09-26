/**
 * Browser-only. Scales a photo down before it is sent to a server action, so
 * a few ordinary phone photos (3 to 5 MB each) fit under the server action
 * body limit (`next.config.ts`, kept under Vercel's 4.5 MB request cap).
 * The server still checks and decodes every image itself
 * (`lib/image-signature.ts`); this only makes the upload small enough to
 * arrive.
 *
 * Never rejects: it returns the original file when it is already small, or
 * when the browser can't decode or re-encode it (a canvas too large for a
 * low memory phone, for one). The server then accepts it or rejects it with
 * a proper field error, so a caller never has to guard this call.
 */
export async function shrinkImage(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  if (file.size <= 600 * 1024) return file;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);

    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    // JPEG, not WebP: every browser can encode it (Safari's canvas can't
    // encode WebP), and product photos don't need transparency.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

/** Total request budget for one product submission's images, under the server action limit. */
export const MAX_TOTAL_UPLOAD_BYTES = 3.5 * 1024 * 1024;

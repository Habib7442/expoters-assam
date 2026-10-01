import "server-only";

import { z } from "zod";

import { readVerifiedImage, type VerifiedImage } from "@/lib/image-signature";
import { deleteFromR2, parseR2Url, uploadToR2 } from "@/lib/storage/r2";

/**
 * Product image rules and R2 plumbing shared by creating a product
 * (submit-product.ts) and editing or deleting one (manage-product.ts), so
 * both paths check and store images exactly the same way.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGES = 5;
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const imageFile = z
  .instanceof(File)
  .refine((file) => file.size > 0, "Choose an image")
  .refine((file) => file.size <= MAX_IMAGE_BYTES, "Each image must be under 2 MB")
  .refine((file) => file.type in ALLOWED_IMAGE_TYPES, "Images must be JPG, PNG, or WebP");

export type UploadImagesResult =
  | { ok: true; urls: string[]; keys: string[] }
  | { ok: false; code: "invalid_images" | "upload_failed" };

/**
 * Verifies every file's real bytes, then uploads them all under
 * `products/{clerkUserId}/{uuid}.{ext}`. Verifying all of them before
 * uploading any means one disguised non-image never leaves the others
 * orphaned in R2; a failed upload cleans up whatever already landed.
 */
export async function uploadProductImages(clerkUserId: string, files: File[]): Promise<UploadImagesResult> {
  const verifiedImages = await Promise.all(files.map(readVerifiedImage));
  if (verifiedImages.some((image) => image === null)) return { ok: false, code: "invalid_images" };

  // allSettled, not all: Promise.all rejects on the first failure while the
  // other uploads are still in flight, so any that finished afterwards would
  // never be cleaned up.
  const keys: string[] = [];
  const uploads = await Promise.allSettled(
    (verifiedImages as VerifiedImage[]).map(async (image) => {
      const key = `${clerkUserId}/${crypto.randomUUID()}.${image.ext}`;
      const url = await uploadToR2("products", key, image.buffer, image.type);
      keys.push(key);
      return url;
    }),
  );
  if (uploads.some((upload) => upload.status === "rejected")) {
    await cleanupUploadedImages(keys);
    return { ok: false, code: "upload_failed" };
  }
  return { ok: true, urls: uploads.map((upload) => (upload as PromiseFulfilledResult<string>).value), keys };
}

/** Best effort only: an orphaned R2 object is an accepted, low cost tradeoff (same reasoning as business-listing.ts's deleteLogoBestEffort). */
export async function cleanupUploadedImages(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map((key) =>
      deleteFromR2("products", key).catch(() => {
        // best effort only
      }),
    ),
  );
}

/**
 * Deletes stored images by their public URL. Returns how many failed, so a
 * caller that must not leave an image behind (deleting a product) can stop
 * before removing the row, and one that can tolerate it (images an edit
 * dropped) can just log. URLs that aren't ours are skipped.
 */
export async function deleteImagesByUrl(urls: string[]): Promise<number> {
  const keys = [...new Set(urls)].map(parseR2Url).filter((parsed) => parsed !== null);
  const deletions = await Promise.allSettled(keys.map(({ category, key }) => deleteFromR2(category, key)));
  return deletions.filter((deletion) => deletion.status === "rejected").length;
}

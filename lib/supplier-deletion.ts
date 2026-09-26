import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { deleteFromR2, parseR2Url } from "@/lib/storage/r2";

export type SupplierDeletionResult = { companyDeleted: boolean; imagesDeleted: number };

/**
 * Removes everything a supplier published when their Clerk account is
 * deleted, keeping the Privacy Policy's promise that listing data does not
 * outlive the account. Deleting the company cascades to its products,
 * WhatsApp contact and memberships; enquiries keep their own row with the
 * company link set to null (they are the buyer's data, on their own
 * retention clock).
 *
 * Images are deleted from R2 *before* the rows, and any failure throws: an
 * image outlives its row at a still-public URL, and once the row is gone a
 * retried webhook can no longer find its key. Throwing leaves the row in
 * place, so the webhook answers 5xx, Clerk retries, and the retry deletes
 * whatever is left (deleting an already-deleted R2 key succeeds).
 *
 * Idempotent: a user with no company, or a retried webhook, is a no-op.
 */
export async function deleteSupplierData(clerkUserId: string): Promise<SupplierDeletionResult> {
  const { data: company, error } = await supabaseAdmin
    .from("companies")
    .select("id, logo_url, products(image_url, gallery_urls)")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (error) throw error;
  if (!company) return { companyDeleted: false, imagesDeleted: 0 };

  const imageUrls = new Set<string>();
  if (company.logo_url) imageUrls.add(company.logo_url);
  for (const product of company.products ?? []) {
    imageUrls.add(product.image_url);
    for (const url of product.gallery_urls ?? []) imageUrls.add(url);
  }

  const keys = [...imageUrls].map(parseR2Url).filter((parsed) => parsed !== null);
  const deletions = await Promise.allSettled(keys.map(({ category, key }) => deleteFromR2(category, key)));
  const failed = deletions.filter((deletion) => deletion.status === "rejected").length;
  if (failed > 0) {
    throw new Error(`${failed} of ${keys.length} images could not be deleted; keeping the listing so a retry can finish`);
  }

  const { error: deleteError } = await supabaseAdmin.from("companies").delete().eq("id", company.id);
  if (deleteError) throw deleteError;

  return { companyDeleted: true, imagesDeleted: keys.length };
}

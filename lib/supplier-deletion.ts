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
 * retention clock). Images are deleted from R2 after the rows, best effort:
 * a leftover image is unreachable once nothing links to it.
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

  const { error: deleteError } = await supabaseAdmin.from("companies").delete().eq("id", company.id);
  if (deleteError) throw deleteError;

  let imagesDeleted = 0;
  await Promise.all(
    [...imageUrls].map(async (url) => {
      const parsed = parseR2Url(url);
      if (!parsed) return;
      try {
        await deleteFromR2(parsed.category, parsed.key);
        imagesDeleted++;
      } catch {
        // best effort only
      }
    }),
  );

  return { companyDeleted: true, imagesDeleted };
}

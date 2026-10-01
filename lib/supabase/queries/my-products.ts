import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type MyProduct = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  status: string;
  rejectionReason: string | null;
  categoryName: string | null;
  createdAt: string;
};

/**
 * Every product of the signed in supplier's own company, any status, most
 * recent first: the My products page (spec 0007, AC-1). Read through
 * supabaseAdmin because the public RLS policy only shows approved rows;
 * the `clerk_user_id` filter on the joined company is what keeps it to the
 * supplier's own products. Throws on a database error.
 */
export async function getMyProducts(clerkUserId: string): Promise<MyProduct[]> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, slug, name, image_url, status, rejection_reason, created_at, categories(name), companies!inner(clerk_user_id)")
    .eq("companies.clerk_user_id", clerkUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.image_url,
    status: row.status,
    rejectionReason: row.rejection_reason,
    categoryName: row.categories?.name ?? null,
    createdAt: row.created_at,
  }));
}

export type MyProductForEdit = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  imageUrls: string[];
  status: string;
  rejectionReason: string | null;
};

/** One of the supplier's own products for the edit page, or null if missing or not theirs. Throws on a database error. */
export async function getMyProductForEdit(clerkUserId: string, productId: string): Promise<MyProductForEdit | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) return null;

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, description, category_id, image_url, gallery_urls, status, rejection_reason, companies!inner(clerk_user_id)")
    .eq("id", productId)
    .eq("companies.clerk_user_id", clerkUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    categoryId: data.category_id,
    imageUrls: data.gallery_urls.length > 0 ? data.gallery_urls : [data.image_url],
    status: data.status,
    rejectionReason: data.rejection_reason,
  };
}

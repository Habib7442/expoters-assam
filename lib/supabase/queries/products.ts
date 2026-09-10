import { supabase } from "@/lib/supabase/client";
import { isR2Url } from "@/lib/storage/r2";

export type ProductWithCompany = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string;
  gallery_urls: string[];
  category: { name: string } | null;
  company: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    location: string | null;
    verified: boolean;
  };
};

/**
 * Fetches an approved product by slug, with its category and company.
 * Uses the anon client: RLS filters both `products` and (via the inner
 * join) `companies` to `status = 'approved'` automatically, so a product
 * whose company isn't approved yet comes back as no rows, same as a
 * missing product.
 */
export async function getProductBySlug(slug: string): Promise<ProductWithCompany | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, slug, name, description, image_url, gallery_urls,
      categories ( name ),
      companies!inner ( id, slug, name, logo_url, location, verified )
    `,
    )
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const galleryUrls = data.gallery_urls.filter((url) => isR2Url(url));
  const imageUrl = isR2Url(data.image_url) ? data.image_url : (galleryUrls[0] ?? data.image_url);
  const logoUrl = data.companies.logo_url && isR2Url(data.companies.logo_url) ? data.companies.logo_url : null;

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description,
    image_url: imageUrl,
    gallery_urls: galleryUrls,
    category: data.categories,
    company: { ...data.companies, logo_url: logoUrl },
  };
}

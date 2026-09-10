import { supabase } from "@/lib/supabase/client";
import { isR2Url } from "@/lib/storage/r2-client";

const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_IMAGE_DOMAIN ?? "";

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

  const galleryUrls = data.gallery_urls.filter((url) => isR2Url(R2_PUBLIC_DOMAIN, url));
  const imageUrl = isR2Url(R2_PUBLIC_DOMAIN, data.image_url) ? data.image_url : (galleryUrls[0] ?? data.image_url);
  const logoUrl =
    data.companies.logo_url && isR2Url(R2_PUBLIC_DOMAIN, data.companies.logo_url) ? data.companies.logo_url : null;

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

/**
 * Turns a product name into a URL safe slug: NFKD-normalizes, strips
 * diacritics, lowercases, collapses non-alphanumeric runs to a single
 * hyphen, trims, and truncates to 80 characters. Falls back to a random id
 * based slug when the name normalizes to nothing (e.g. a name in a script
 * this naive rule strips entirely), so a slug is never blank.
 *
 * This only produces a candidate; it does not guarantee uniqueness. The
 * caller retries the insert with a suffix on a unique_violation (23505).
 */
export function generateSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return base || `product-${crypto.randomUUID().slice(0, 8)}`;
}

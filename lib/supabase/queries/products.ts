import { supabase } from "@/lib/supabase/client";
import { isR2Url } from "@/lib/storage/r2";
import { containsPattern } from "@/lib/supabase/like-pattern";

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  companyName: string;
};

type GetProductsOptions = {
  categorySlug?: string;
  /** The supplier's country, as stored on the company (e.g. "India"). */
  country?: string;
  query?: string;
  limit?: number;
};

/**
 * Approved products from approved, *verified* companies (RLS-equivalent
 * filter applied explicitly since `companies` is joined, not the queried
 * table itself) — the page listing these calls them "verified exporters",
 * so the query enforces that rather than relying on `verified` happening to
 * mirror `status = 'approved'` today (true only because the one place that
 * approves a company also sets `verified: true` in the same write; nothing
 * enforces they stay coupled, and a future membership tier is already
 * expected to decouple them — see company-approvals.ts). Most recent first.
 * `categorySlug` needs `categories!inner` to actually exclude non-matching
 * rows — PostgREST only filters top-level rows through a left-joined embed
 * when it's `!inner` (same reasoning as `companies` here and in
 * getFeaturedProducts).
 *
 * Returns `null` when the query itself failed, never `[]`: an empty array
 * means "no products match," and a database failure must not be reported
 * to a visitor as that.
 */
export async function getProducts({
  categorySlug,
  country,
  query,
  limit = 60,
}: GetProductsOptions = {}): Promise<ProductListItem[] | null> {
  const builder = categorySlug
    ? supabase
        .from("products")
        .select("id, slug, name, image_url, companies!inner(name, status, verified), categories!inner(slug)")
        .eq("categories.slug", categorySlug)
    : supabase.from("products").select("id, slug, name, image_url, companies!inner(name, status, verified)");

  let filtered = builder.eq("status", "approved").eq("companies.status", "approved").eq("companies.verified", true);
  if (country) filtered = filtered.eq("companies.country", country);
  if (query) filtered = filtered.ilike("name", containsPattern(query));

  const { data, error } = await filtered
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("getProducts failed", error);
    return null;
  }

  return (data ?? [])
    .filter((product) => isR2Url(product.image_url))
    .map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: product.image_url,
      companyName: product.companies.name,
    }));
}

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

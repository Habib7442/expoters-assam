import { supabase } from "@/lib/supabase/client";
import { isR2Url } from "@/lib/storage/r2";

export type CategoryWithCount = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  productCount: number;
};

/**
 * Every category with a live count of its approved products (whose company
 * is also approved), one aggregate fetch rather than one query per category
 * (AC-5). Zero is a valid count; a category is never dropped for having one.
 *
 * The count comes from the `category_product_counts` view (grouped, computed
 * entirely in Postgres), not a client-side count over fetched product rows:
 * PostgREST's `max_rows = 1000` (supabase/config.toml) would otherwise
 * silently truncate the product list once approved products cross that
 * count, understating some categories with no error. The view returns at
 * most one row per category regardless of how many products exist, so it
 * can never hit that limit.
 */
export async function getCategoriesWithProductCounts(): Promise<CategoryWithCount[] | null> {
  const [
    { data: categories, error: categoriesError },
    { data: counts, error: countsError },
  ] = await Promise.all([
    supabase.from("categories").select("id, name, slug, image_url").order("name", { ascending: true }),
    supabase.from("category_product_counts").select("category_id, product_count"),
  ]);

  if (categoriesError || countsError) {
    console.error("getCategoriesWithProductCounts failed", categoriesError ?? countsError);
    return null;
  }

  const countByCategory = new Map<string, number>();
  for (const row of counts ?? []) {
    if (row.category_id) countByCategory.set(row.category_id, row.product_count ?? 0);
  }

  return (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    imageUrl: category.image_url && isR2Url(category.image_url) ? category.image_url : null,
    productCount: countByCategory.get(category.id) ?? 0,
  }));
}

export type FeaturedProduct = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  companyName: string;
};

/** Up to `limit` approved products from approved companies, most recent first (AC-6). */
export async function getFeaturedProducts(limit: number): Promise<FeaturedProduct[] | null> {
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, image_url, companies!inner(name, status)")
    .eq("status", "approved")
    .eq("companies.status", "approved")
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("getFeaturedProducts failed", error);
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

export type FeaturedExporter = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  location: string;
  verified: boolean;
};

/** Up to `limit` approved companies, most recent first (AC-7); `location` falls back to `country`. */
export async function getFeaturedExporters(limit: number): Promise<FeaturedExporter[] | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, slug, name, logo_url, location, country, verified")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("getFeaturedExporters failed", error);
    return null;
  }

  return (data ?? []).map((company) => ({
    id: company.id,
    slug: company.slug,
    name: company.name,
    logoUrl: company.logo_url && isR2Url(company.logo_url) ? company.logo_url : null,
    location: company.location ?? company.country,
    verified: company.verified,
  }));
}

export type LatestBuyRequirement = {
  id: string;
  productText: string;
  quantity: string;
  location: string | null;
  createdAt: string;
};

/**
 * Up to `limit` public buy requirements, most recent first (AC-8). Selects
 * only the public-safe columns, never `contact_name`/`contact_email`/`buyer_id`.
 */
export async function getLatestBuyRequirements(limit: number): Promise<LatestBuyRequirement[] | null> {
  const { data, error } = await supabase
    .from("buy_requirements")
    .select("id, product_text, quantity, location, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("getLatestBuyRequirements failed", error);
    return null;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    productText: row.product_text,
    quantity: row.quantity,
    location: row.location,
    createdAt: row.created_at,
  }));
}

export type DirectoryStats = {
  verifiedExporters: number;
  products: number;
  buyers: number;
  countries: number;
};

/** The hero's stats strip counts, read from the `directory_stats` view (AC-9). */
export async function getDirectoryStats(): Promise<DirectoryStats | null> {
  const { data, error } = await supabase
    .from("directory_stats")
    .select("verified_exporters, products, buyers, countries")
    .maybeSingle();

  if (error) {
    console.error("getDirectoryStats failed", error);
    return null;
  }

  // directory_stats is four independent scalar count() subqueries with no
  // base FROM/GROUP BY, so it always returns exactly one row today (verified
  // live) — this guard is for if that ever changes, not a currently
  // reachable case. Same contract as every sibling function here: null
  // means "hide the section," never a strip of real-looking zeros.
  if (!data) return null;

  return {
    verifiedExporters: data.verified_exporters ?? 0,
    products: data.products ?? 0,
    buyers: data.buyers ?? 0,
    countries: data.countries ?? 0,
  };
}

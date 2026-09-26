import "server-only";
import { supabase } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isR2Url } from "@/lib/storage/r2";
import { searchIds, sortByRank } from "@/lib/supabase/queries/search";

export type MyCompany = {
  id: string;
  name: string;
  addressLine: string | null;
  location: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  logoUrl: string | null;
  about: string | null;
  email: string;
  gstNumber: string | null;
  status: string;
  rejectionReason: string | null;
  whatsappNumber: string | null;
};

/**
 * The signed in Clerk user's own company, whatever its status. Uses
 * `supabaseAdmin` deliberately: a `pending`/`rejected` row is invisible to
 * the public `status = 'approved'` RLS policy, and this is the one read
 * path that must still see it, scoped to the caller's own `clerk_user_id`.
 */
export async function getMyCompany(clerkUserId: string): Promise<MyCompany | null> {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select(
      "id, name, address_line, location, state, postal_code, country, logo_url, about, email, gst_number, status, rejection_reason, company_contacts(whatsapp_number)",
    )
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    addressLine: data.address_line,
    location: data.location,
    state: data.state,
    postalCode: data.postal_code,
    country: data.country,
    logoUrl: data.logo_url,
    about: data.about,
    email: data.email,
    gstNumber: data.gst_number,
    status: data.status,
    rejectionReason: data.rejection_reason,
    whatsappNumber: data.company_contacts?.whatsapp_number ?? null,
  };
}

export type CompanyListItem = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  location: string;
  verified: boolean;
};

type GetCompaniesOptions = {
  query?: string;
  /** Only companies with at least one approved product in this category. */
  categorySlug?: string;
  country?: string;
  limit?: number;
};

/**
 * Approved companies, most recent first, optionally filtered by name, category and country: the
 * /companies directory page. Doesn't filter by `verified`: unlike the
 * products/featured-products copy ("verified exporters"), this page's copy
 * says "approved exporters" and shows the badge per-card, so an approved
 * but not-yet-verified company still belongs here, just without the badge.
 *
 * Returns `null` when the query itself failed, never `[]`: an empty array
 * means "the directory really has no matches," and a database failure must
 * not be reported to a visitor as that.
 */
export async function getCompanies({ query, categorySlug, country, limit = 60 }: GetCompaniesOptions = {}): Promise<
  CompanyListItem[] | null
> {
  // A search keeps its ranked order and applies the limit after ranking (see getProducts).
  const rankedIds = query ? await searchIds("companies", query, { categorySlug, country }) : null;
  if (query && rankedIds === null) return null;
  if (rankedIds?.length === 0) return [];

  // A category filter needs the products embed as !inner so companies with
  // no matching approved product drop out (same reasoning as getProducts);
  // PostgREST still returns each company once.
  let filtered = categorySlug
    ? supabase
        .from("companies")
        .select("id, slug, name, logo_url, location, country, verified, products!inner(status, categories!inner(slug))")
        .eq("status", "approved")
        .eq("products.status", "approved")
        .eq("products.categories.slug", categorySlug)
    : supabase.from("companies").select("id, slug, name, logo_url, location, country, verified").eq("status", "approved");
  if (country) filtered = filtered.eq("country", country);
  if (rankedIds) filtered = filtered.in("id", rankedIds);

  const { data, error } = await filtered
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(rankedIds ? rankedIds.length : limit);

  if (error) {
    console.error("getCompanies failed", error);
    return null;
  }

  const rows = rankedIds ? sortByRank(data ?? [], rankedIds).slice(0, limit) : (data ?? []);
  return rows.map((company) => ({
    id: company.id,
    slug: company.slug,
    name: company.name,
    logoUrl: company.logo_url && isR2Url(company.logo_url) ? company.logo_url : null,
    location: company.location ?? company.country,
    verified: company.verified,
  }));
}

/**
 * The distinct countries of approved companies, alphabetical, for the
 * country filter. Returns `null` on failure (the filter row is then just
 * left out). Read through the anon client, so it only ever sees approved
 * rows; fine while the directory has under 1000 approved companies
 * (PostgREST max_rows), after which a grouped view would be the fix.
 */
export async function getCompanyCountries({ verifiedOnly = false }: { verifiedOnly?: boolean } = {}): Promise<
  string[] | null
> {
  let filtered = supabase.from("companies").select("country").eq("status", "approved");
  // /products only lists verified suppliers, so its chips must too, or a chip could lead to an empty page.
  if (verifiedOnly) filtered = filtered.eq("verified", true);
  const { data, error } = await filtered;
  if (error) {
    console.error("getCompanyCountries failed", error);
    return null;
  }
  return [...new Set((data ?? []).map((row) => row.country).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export type CompanyProductSummary = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  categoryName?: string | null;
};

export type CompanyProfile = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  about: string | null;
  location: string | null;
  country: string;
  verified: boolean;
  createdAt?: string;
  products: CompanyProductSummary[];
};

/**
 * A company's public profile page by slug: only an `approved` company, with
 * its own `approved` products, newest first. RLS already enforces both
 * (`companies` and `products` each have an approved only policy); the
 * explicit filters are a second layer, same as every sibling read path, so
 * this stays safe if the query is ever moved to another client. A stray
 * non-R2 image/logo URL is treated as "no image" rather than handed to
 * `next/image`, same guard as the product page and home page.
 */
export async function getCompanyBySlug(slug: string): Promise<CompanyProfile | null> {
  const { data, error } = await supabase
    .from("companies")
    .select(
      `
      id, name, slug, logo_url, about, location, country, verified, created_at,
      products ( id, slug, name, image_url, categories ( name ) )
    `,
    )
    .eq("slug", slug)
    .eq("status", "approved")
    .eq("products.status", "approved")
    .order("created_at", { referencedTable: "products", ascending: false })
    .order("id", { referencedTable: "products", ascending: true })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    logoUrl: data.logo_url && isR2Url(data.logo_url) ? data.logo_url : null,
    about: data.about,
    location: data.location,
    country: data.country,
    verified: data.verified,
    createdAt: data.created_at,
    products: data.products.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: isR2Url(product.image_url) ? product.image_url : null,
      categoryName: product.categories?.name ?? null,
    })),
  };
}

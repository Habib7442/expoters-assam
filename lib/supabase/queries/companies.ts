import "server-only";
import { supabase } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isR2Url } from "@/lib/storage/r2";

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

/**
 * Approved companies, most recent first, optionally filtered by name — the
 * /companies directory page. Doesn't filter by `verified`: unlike the
 * products/featured-products copy ("verified exporters"), this page's copy
 * says "approved exporters" and shows the badge per-card, so an approved
 * but not-yet-verified company still belongs here, just without the badge.
 */
export async function getCompanies({ query, limit = 60 }: { query?: string; limit?: number } = {}): Promise<
  CompanyListItem[]
> {
  let filtered = supabase
    .from("companies")
    .select("id, slug, name, logo_url, location, country, verified")
    .eq("status", "approved");
  if (query) filtered = filtered.ilike("name", `%${query}%`);

  const { data, error } = await filtered
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("getCompanies failed", error);
    return [];
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
 * A company's public profile page by slug: only an `approved` company (the
 * anon client's RLS policy filters this automatically), with its own
 * `approved` products (the `products` table's separate policy does the
 * same). A stray non-R2 image/logo URL is treated as "no image" rather than
 * handed to `next/image`, same guard as the product page and home page.
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
      categoryName: (product as unknown as { categories: { name: string } | null })?.categories?.name ?? null,
    })),
  };
}

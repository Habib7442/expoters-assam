import "server-only";
import { supabase } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isR2Url } from "@/lib/storage/r2-client";

const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_IMAGE_DOMAIN ?? "";

export type MyCompany = {
  id: string;
  name: string;
  location: string | null;
  logoUrl: string | null;
  about: string | null;
  email: string;
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
    .select("id, name, location, logo_url, about, email, status, rejection_reason, company_contacts(whatsapp_number)")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    location: data.location,
    logoUrl: data.logo_url,
    about: data.about,
    email: data.email,
    status: data.status,
    rejectionReason: data.rejection_reason,
    whatsappNumber: data.company_contacts?.whatsapp_number ?? null,
  };
}

export type CompanyProductSummary = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
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
      id, name, slug, logo_url, about, location, country, verified,
      products ( id, slug, name, image_url )
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
    logoUrl: data.logo_url && isR2Url(R2_PUBLIC_DOMAIN, data.logo_url) ? data.logo_url : null,
    about: data.about,
    location: data.location,
    country: data.country,
    verified: data.verified,
    products: data.products.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: isR2Url(R2_PUBLIC_DOMAIN, product.image_url) ? product.image_url : null,
    })),
  };
}

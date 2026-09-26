import type { MetadataRoute } from "next";

import { supabase } from "@/lib/supabase/client";
import { absoluteUrl } from "@/lib/site";

// Rebuilt at most hourly: new approvals reach search engines within the
// hour without a database round trip on every crawler request.
export const revalidate = 3600;

const STATIC_PAGES = ["/", "/products", "/companies", "/buy-requirements", "/about", "/contact", "/faq", "/membership", "/privacy", "/terms"];

/**
 * Every public, indexable URL. Read through the anon client, so RLS limits
 * it to approved products and companies; products are further limited to
 * verified suppliers, the same rule /products uses, so the sitemap never
 * lists a page that would 404. A failed query just drops that group: a
 * sitemap without products beats no sitemap at all.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, companies, categories] = await Promise.all([
    supabase
      .from("products")
      .select("slug, updated_at, companies!inner(status, verified)")
      .eq("status", "approved")
      .eq("companies.status", "approved")
      .eq("companies.verified", true),
    supabase.from("companies").select("slug, created_at").eq("status", "approved"),
    supabase.from("categories").select("slug"),
  ]);

  for (const [name, result] of Object.entries({ products, companies, categories })) {
    if (result.error) console.error(`sitemap: ${name} query failed`, result.error);
  }

  return [
    ...STATIC_PAGES.map((path) => ({ url: absoluteUrl(path) })),
    ...(categories.data ?? []).map((c) => ({ url: absoluteUrl(`/products?category=${encodeURIComponent(c.slug)}`) })),
    ...(companies.data ?? []).map((c) => ({
      url: absoluteUrl(`/companies/${c.slug}`),
      lastModified: new Date(c.created_at),
    })),
    ...(products.data ?? []).map((p) => ({
      url: absoluteUrl(`/products/${p.slug}`),
      lastModified: new Date(p.updated_at),
    })),
  ];
}

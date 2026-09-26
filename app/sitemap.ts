import type { MetadataRoute } from "next";

import { supabase } from "@/lib/supabase/client";
import { absoluteUrl } from "@/lib/site";

// Rebuilt at most hourly: new approvals reach search engines within the
// hour without a database round trip on every crawler request.
export const revalidate = 3600;

const STATIC_PAGES = ["/", "/products", "/companies", "/buy-requirements", "/about", "/contact", "/faq", "/membership", "/privacy", "/terms"];

/** Must not exceed PostgREST's max_rows (supabase/config.toml), or pages would come back short and end the loop early. */
const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Every row of a query, fetched page by page. PostgREST silently truncates a
 * single response at max_rows (1000) with no error, so one unpaged query
 * would quietly drop URLs once the directory outgrows it. Each page must be
 * built with a stable `.order()` so pages neither overlap nor skip rows. A
 * failed page keeps what was already fetched: a partial sitemap beats none.
 */
async function fetchAllRows<T>(name: string, page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error(`sitemap: ${name} query failed`, error);
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/**
 * Every public, indexable URL. Read through the anon client, so RLS limits
 * it to approved products and companies; products are further limited to
 * verified suppliers, the same rule /products uses, so the sitemap never
 * lists a page that would 404.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, companies, categories] = await Promise.all([
    fetchAllRows("products", (from, to) =>
      supabase
        .from("products")
        .select("slug, updated_at, companies!inner(status, verified)")
        .eq("status", "approved")
        .eq("companies.status", "approved")
        .eq("companies.verified", true)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows("companies", (from, to) =>
      supabase.from("companies").select("slug, created_at").eq("status", "approved").order("id").range(from, to),
    ),
    fetchAllRows("categories", (from, to) => supabase.from("categories").select("slug").order("id").range(from, to)),
  ]);

  return [
    ...STATIC_PAGES.map((path) => ({ url: absoluteUrl(path) })),
    ...categories.map((c) => ({ url: absoluteUrl(`/products?category=${encodeURIComponent(c.slug)}`) })),
    ...companies.map((c) => ({
      url: absoluteUrl(`/companies/${c.slug}`),
      lastModified: new Date(c.created_at),
    })),
    ...products.map((p) => ({
      url: absoluteUrl(`/products/${p.slug}`),
      lastModified: new Date(p.updated_at),
    })),
  ];
}

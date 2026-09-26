import { supabase } from "@/lib/supabase/client";

export type SearchKind = "products" | "companies" | "buy-requirements";

/**
 * List page filters applied *inside* the search, before its 100 match cap,
 * so a filtered search never loses matches that ranked below the cap.
 * Ignored for buy requirements, which have no filters.
 */
export type SearchFilters = {
  categorySlug?: string;
  country?: string;
};

/**
 * Ids of the rows matching `query`, best match first: a literal "contains"
 * match ranks above a typo tolerant (trigram) one. The ranking and the
 * visibility filters live in Postgres (migrations 20260926030000 and
 * 20260926040000); callers read the rows they need with `.in("id", ids)`
 * and put them back in this order with `sortByRank`.
 *
 * Returns `null` when the lookup failed, never `[]`, so a database error is
 * not shown to a visitor as "no matches".
 */
export async function searchIds(
  kind: SearchKind,
  query: string,
  { categorySlug, country }: SearchFilters = {},
  maxResults = 100,
): Promise<string[] | null> {
  const filters = { category_slug: categorySlug, company_country: country };
  const { data, error } =
    kind === "products"
      ? await supabase.rpc("search_product_ids", { search: query, max_results: maxResults, ...filters })
      : kind === "companies"
        ? await supabase.rpc("search_company_ids", { search: query, max_results: maxResults, ...filters })
        : await supabase.rpc("search_buy_requirement_ids", { search: query, max_results: maxResults });

  if (error) {
    console.error(`searchIds(${kind}) failed`, error);
    return null;
  }

  return (data ?? []).map((row) => row.id);
}

/** Puts `rows` back in the ranked order of `ids` (an `.in()` read returns them unordered). */
export function sortByRank<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const rank = new Map(ids.map((id, index) => [id, index]));
  return [...rows].sort((a, b) => (rank.get(a.id) ?? ids.length) - (rank.get(b.id) ?? ids.length));
}

import { supabase } from "@/lib/supabase/client";

export type SearchKind = "products" | "companies" | "buy-requirements";

const SEARCH_FUNCTIONS = {
  products: "search_product_ids",
  companies: "search_company_ids",
  "buy-requirements": "search_buy_requirement_ids",
} as const;

/**
 * Ids of the rows matching `query`, best match first: a literal "contains"
 * match ranks above a typo tolerant (trigram) one. The ranking lives in
 * Postgres (migration 20260926030000); callers read the rows they need
 * with `.in("id", ids)` and put them back in this order with `sortByRank`.
 *
 * Returns `null` when the lookup failed, never `[]`, so a database error is
 * not shown to a visitor as "no matches".
 */
export async function searchIds(kind: SearchKind, query: string, maxResults = 100): Promise<string[] | null> {
  const { data, error } = await supabase.rpc(SEARCH_FUNCTIONS[kind], {
    search: query,
    max_results: maxResults,
  });

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

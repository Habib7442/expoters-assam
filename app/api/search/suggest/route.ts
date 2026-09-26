import type { NextRequest } from "next/server";

import { getCompanies } from "@/lib/supabase/queries/companies";
import { getLatestBuyRequirements } from "@/lib/supabase/queries/home";
import { getProducts } from "@/lib/supabase/queries/products";
import type { SearchKind } from "@/lib/supabase/queries/search";

export type SearchSuggestion = {
  label: string;
  /** A short second line: the supplier, the location, or the quantity. */
  detail: string | null;
  href: string;
};

const MAX_SUGGESTIONS = 6;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;

function isSearchKind(value: string | null): value is SearchKind {
  return value === "products" || value === "companies" || value === "buy-requirements";
}

/**
 * Suggestions shown under the home page search box as the visitor types.
 * Reuses the list pages' own queries, so a suggestion is exactly a top
 * result of that page (same visibility rules, same typo tolerant ranking).
 * Returns `null` on a database failure.
 */
async function suggest(scope: SearchKind, query: string): Promise<SearchSuggestion[] | null> {
  if (scope === "products") {
    const products = await getProducts({ query, limit: MAX_SUGGESTIONS });
    return (
      products?.map((product) => ({
        label: product.name,
        detail: product.companyName,
        href: `/products/${product.slug}`,
      })) ?? null
    );
  }

  if (scope === "companies") {
    const companies = await getCompanies({ query, limit: MAX_SUGGESTIONS });
    return (
      companies?.map((company) => ({
        label: company.name,
        detail: company.location || null,
        href: `/companies/${company.slug}`,
      })) ?? null
    );
  }

  const requirements = await getLatestBuyRequirements(MAX_SUGGESTIONS, query);
  return (
    requirements?.map((requirement) => ({
      label: requirement.productText,
      detail: requirement.quantity,
      href: `/buy-requirements?q=${encodeURIComponent(requirement.productText)}`,
    })) ?? null
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const scope = params.get("scope");
  const query = (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  if (!isSearchKind(scope)) {
    return Response.json({ error: "Unknown search scope" }, { status: 400 });
  }
  if (query.length < MIN_QUERY_LENGTH) {
    return Response.json({ suggestions: [] });
  }

  const suggestions = await suggest(scope, query);
  if (suggestions === null) {
    return Response.json({ error: "Search is unavailable right now" }, { status: 503 });
  }

  // Public, anonymous data: a short shared cache absorbs repeat keystrokes.
  return Response.json(
    { suggestions },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}

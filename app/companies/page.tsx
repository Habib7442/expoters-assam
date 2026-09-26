import type { Metadata } from "next";
import Link from "next/link";

import { getCompanies, getCompanyCountries } from "@/lib/supabase/queries/companies";
import { getCategoriesWithProductCounts } from "@/lib/supabase/queries/home";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/filter-chips";
import { SearchBar } from "@/components/search-bar";
import { firstParam, type SearchParamValue } from "@/lib/search-params";
import { ExporterCard } from "@/components/exporter-card";
import { LoadFailedState } from "@/components/load-failed-state";

export const metadata: Metadata = {
  title: "Companies | Exporters Assam",
  description: "Browse approved exporters on the Exporters Assam directory.",
};

// Real Supabase data, not build-time content: without a dynamic API in this
// page, Next would otherwise prerender it once and freeze that snapshot
// (same reasoning as app/page.tsx).
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: SearchParamValue; category?: SearchParamValue; country?: SearchParamValue }>;
};

export default async function CompaniesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = firstParam(params.q);
  const category = firstParam(params.category);
  const country = firstParam(params.country);

  const [companies, categories, countries] = await Promise.all([
    getCompanies({ query: q, categorySlug: category, country }),
    getCategoriesWithProductCounts(),
    getCompanyCountries(),
  ]);

  const categoryLabel = (categories ?? []).find((c) => c.slug === category)?.name ?? category;
  const filterParams = new URLSearchParams();
  if (q) filterParams.set("q", q);
  if (category) filterParams.set("category", category);
  if (country) filterParams.set("country", country);
  const retryHref = filterParams.size > 0 ? `/companies?${filterParams.toString()}` : "/companies";
  const filterSummary = [
    categoryLabel && `in “${categoryLabel}”`,
    country && `from ${country}`,
    q && `matching “${q}”`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex flex-col gap-1 sm:mb-8">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">Companies</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Approved exporters on the directory.</p>
        </div>

        <SearchBar placeholder="Search companies..." className="mb-6 sm:mb-8" />

        <div className="mb-8 flex flex-col gap-3">
          {categories && categories.length > 0 && (
            <FilterChips
              basePath="/companies"
              param="category"
              label="Category"
              // A category with no products can only lead to an empty page; keep it only if already picked.
              options={categories
                .filter((c) => c.productCount > 0 || c.slug === category)
                .map((c) => ({ value: c.slug, label: c.name }))}
              active={category}
              otherParams={{ country, q }}
            />
          )}
          {/* One country is not a choice: the row appears once a second exists (or one is already picked). */}
          {countries && (countries.length > 1 || country) && (
            <FilterChips
              basePath="/companies"
              param="country"
              label="Country"
              options={countries.map((c) => ({ value: c, label: c }))}
              active={country}
              otherParams={{ category, q }}
            />
          )}
        </div>

        {companies === null ? (
          <LoadFailedState what="companies" retryHref={retryHref} />
        ) : companies.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {companies.map((company) => (
              <ExporterCard
                key={company.id}
                slug={company.slug}
                name={company.name}
                logoUrl={company.logoUrl}
                location={company.location}
                verified={company.verified}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground sm:text-base">
              {filterSummary ? `No companies ${filterSummary}.` : "No companies found."}
            </p>
            {filterSummary && (
              <Button variant="outline" className="rounded-full" render={<Link href="/companies" />} nativeButton={false}>
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

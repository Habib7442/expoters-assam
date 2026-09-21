import type { Metadata } from "next";

import { getCompanies } from "@/lib/supabase/queries/companies";
import { SearchBar } from "@/components/search-bar";
import { firstParam, type SearchParamValue } from "@/lib/search-params";
import { ExporterCard } from "@/components/exporter-card";
import { LoadFailedState } from "@/components/load-failed-state";

export const metadata: Metadata = {
  title: "Companies | ExportsAssam",
  description: "Browse approved exporters on the ExportsAssam directory.",
};

// Real Supabase data, not build-time content: without a dynamic API in this
// page, Next would otherwise prerender it once and freeze that snapshot
// (same reasoning as app/page.tsx).
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: SearchParamValue }>;
};

export default async function CompaniesPage({ searchParams }: Props) {
  const q = firstParam((await searchParams).q);

  const companies = await getCompanies({ query: q });

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex flex-col gap-1 sm:mb-8">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">Companies</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Approved exporters on the directory.</p>
        </div>

        <SearchBar placeholder="Search companies..." className="mb-6 sm:mb-8" />

        {companies === null ? (
          <LoadFailedState what="companies" retryHref={q ? `/companies?q=${encodeURIComponent(q)}` : "/companies"} />
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
          <p className="text-sm text-muted-foreground">No companies found.</p>
        )}
      </div>
    </main>
  );
}

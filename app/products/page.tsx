import type { Metadata } from "next";
import Link from "next/link";

import { getCategoriesWithProductCounts } from "@/lib/supabase/queries/home";
import { getProducts, type ProductListItem } from "@/lib/supabase/queries/products";
import { getCompanyCountries } from "@/lib/supabase/queries/companies";
import { FilterChips } from "@/components/filter-chips";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/search-bar";
import { firstParam, type SearchParamValue } from "@/lib/search-params";
import { ProductCard } from "@/components/product-card";
import { LoadFailedState } from "@/components/load-failed-state";

export const metadata: Metadata = {
  title: "Products | Exporters Assam",
  description: "Browse approved products from verified Assam and Indian exporters.",
};

// Real Supabase data, not build-time content: without a dynamic API in this
// page, Next would otherwise prerender it once and freeze that snapshot
// (same reasoning as app/page.tsx).
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ category?: SearchParamValue; country?: SearchParamValue; q?: SearchParamValue }>;
};

function ProductGrid({ products }: { products: ProductListItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          slug={product.slug}
          name={product.name}
          imageUrl={product.imageUrl}
          companyName={product.companyName}
        />
      ))}
    </div>
  );
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const category = firstParam(params.category);
  const country = firstParam(params.country);
  const q = firstParam(params.q);

  const [categories, countries, products] = await Promise.all([
    getCategoriesWithProductCounts(),
    getCompanyCountries({ verifiedOnly: true }),
    getProducts({ categorySlug: category, country, query: q }),
  ]);

  const activeCategory = category ? (categories ?? []).find((c) => c.slug === category) : null;
  const categoryLabel = activeCategory?.name ?? category;

  // Both filters together matched nothing: look at each one on its own, so
  // the visitor still sees any products that match either half of what
  // they asked for instead of a dead end. With only one filter active
  // there's nothing to relax, so this stays empty. Skipped when the main
  // query *failed* (null): that's an error to show, not an empty result to
  // pad with suggestions. These two lookups are best-effort extras, so if
  // one of them fails its section is simply omitted.
  const relaxed =
    products !== null && products.length === 0 && category && q
      ? await Promise.all([getProducts({ query: q, country }), getProducts({ categorySlug: category, country })])
      : null;
  const matchingSearch = relaxed?.[0] ?? [];
  const matchingCategory = relaxed?.[1] ?? [];
  const hasFilters = Boolean(category || country || q);
  // Same wording as /companies: every active filter is named, so the message never hides one.
  const filterSummary = [
    category && `in “${categoryLabel}”`,
    country && `from ${country}`,
    q && `matching “${q}”`,
  ]
    .filter(Boolean)
    .join(" ");

  const retryParams = new URLSearchParams();
  if (category) retryParams.set("category", category);
  if (country) retryParams.set("country", country);
  if (q) retryParams.set("q", q);
  const retryHref = retryParams.size > 0 ? `/products?${retryParams.toString()}` : "/products";

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex flex-col gap-1 sm:mb-8">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">
            {activeCategory ? activeCategory.name : "Products"}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Approved products from verified exporters.
          </p>
        </div>

        <SearchBar placeholder="Search products..." className="mb-6 sm:mb-8" />

        <div className="mb-8 flex flex-col gap-3">
          {categories && categories.length > 0 && (
            <FilterChips
              basePath="/products"
              param="category"
              label="Category"
              options={categories.map((c) => ({ value: c.slug, label: c.name }))}
              active={category}
              otherParams={{ country, q }}
            />
          )}
          {/* One country is not a choice: the row appears once a second exists (or one is already picked). */}
          {countries && (countries.length > 1 || country) && (
            <FilterChips
              basePath="/products"
              param="country"
              label="Country"
              options={countries.map((c) => ({ value: c, label: c }))}
              active={country}
              otherParams={{ category, q }}
            />
          )}
        </div>

        {products === null ? (
          <LoadFailedState what="products" retryHref={retryHref} />
        ) : products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground sm:text-base">
                {filterSummary ? `No products ${filterSummary}.` : "No products found."}
              </p>
              {hasFilters && (
                <Button variant="outline" className="rounded-full" render={<Link href="/products" />} nativeButton={false}>
                  Clear filters
                </Button>
              )}
            </div>

            {matchingSearch.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="font-heading text-lg font-semibold text-green-deep">
                  Matching “{q}” in all categories{country ? ` from ${country}` : ""}
                </h2>
                <ProductGrid products={matchingSearch} />
              </section>
            )}

            {matchingCategory.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="font-heading text-lg font-semibold text-green-deep">
                  All products in {categoryLabel}{country ? ` from ${country}` : ""}
                </h2>
                <ProductGrid products={matchingCategory} />
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

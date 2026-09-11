import type { Metadata } from "next";
import Link from "next/link";

import { getCategoriesWithProductCounts } from "@/lib/supabase/queries/home";
import { getProducts } from "@/lib/supabase/queries/products";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/search-bar";
import { ProductCard } from "@/components/product-card";

export const metadata: Metadata = {
  title: "Products | ExportsAssam",
  description: "Browse approved products from verified Assam and Indian exporters.",
};

// Real Supabase data, not build-time content: without a dynamic API in this
// page, Next would otherwise prerender it once and freeze that snapshot
// (same reasoning as app/page.tsx).
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ category?: string; q?: string }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const { category, q } = await searchParams;

  const [categories, products] = await Promise.all([
    getCategoriesWithProductCounts(),
    getProducts({ categorySlug: category, query: q }),
  ]);

  const activeCategory = category ? (categories ?? []).find((c) => c.slug === category) : null;

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

        {categories && categories.length > 0 && (
          <div className="mb-8 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link href={q ? `/products?q=${encodeURIComponent(q)}` : "/products"}>
              <Badge
                variant={!category ? "default" : "secondary"}
                className="h-auto shrink-0 rounded-full px-3 py-1.5 text-xs font-medium"
              >
                All
              </Badge>
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={
                  q
                    ? `/products?category=${c.slug}&q=${encodeURIComponent(q)}`
                    : `/products?category=${c.slug}`
                }
              >
                <Badge
                  variant={category === c.slug ? "default" : "secondary"}
                  className="h-auto shrink-0 rounded-full px-3 py-1.5 text-xs font-medium"
                >
                  {c.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {products.length > 0 ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">No products found.</p>
        )}
      </div>
    </main>
  );
}

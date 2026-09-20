import Image from "next/image";
import Link from "next/link";
import { Building2, Globe, Handshake, PackagePlus, ShieldCheck, TrendingUp, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeroSearch } from "@/components/hero-search";
import { CategoryTile } from "@/components/category-tile";
import { ProductCard } from "@/components/product-card";
import { ExporterCard } from "@/components/exporter-card";
import { BuyRequirementCard } from "@/components/buy-requirement-card";
import {
  getCategoriesWithProductCounts,
  getFeaturedProducts,
  getFeaturedExporters,
  getLatestBuyRequirements,
} from "@/lib/supabase/queries/home";

// Placeholder chip names, used only if the real categories fail to load.
const FALLBACK_CATEGORY_CHIPS = [
  "Agarwood Inoculation",
  "Live Plants",
  "Spices",
  "Essential Oils",
  "Tea",
  "Handicrafts",
];

const VALUE_PROPS = [
  { icon: Globe, label: "Global Reach" },
  { icon: ShieldCheck, label: "Verified Businesses" },
  { icon: Handshake, label: "Trusted Connections" },
  { icon: TrendingUp, label: "Grow Your Business" },
];

const LISTING_STEPS = [
  {
    number: 1,
    icon: UserPlus,
    title: "Create Account",
    description: "Sign up free with your name and phone number.",
  },
  {
    number: 2,
    icon: Building2,
    title: "List Your Business",
    description: "Add your business name, location, and WhatsApp number.",
  },
  {
    number: 3,
    icon: PackagePlus,
    title: "List Your Products",
    description: "Add your products once your business is approved.",
  },
];

// Real Supabase data, not build-time content: without a dynamic API in this
// page, Next would otherwise prerender it once and freeze that snapshot.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, featuredProducts, featuredExporters, latestBuyRequirements] =
    await Promise.all([
      getCategoriesWithProductCounts(),
      getFeaturedProducts(8),
      getFeaturedExporters(6),
      getLatestBuyRequirements(5),
    ]);

  const categoryChipNames =
    categories && categories.length > 0
      ? categories.map((category) => category.name)
      : FALLBACK_CATEGORY_CHIPS;

  return (
    <main className="flex flex-1 flex-col bg-bg-soft w-full overflow-x-hidden">
      <section className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-2 sm:px-6 sm:pt-8">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categoryChipNames.map((chip) => (
            <Badge
              key={chip}
              variant="secondary"
              className="h-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium sm:px-3 sm:py-1.5 sm:text-xs"
            >
              {chip}
            </Badge>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-8 rounded-2xl bg-green-wash px-5 py-8 sm:rounded-[28px] sm:px-10 sm:py-14 lg:grid-cols-2 lg:items-center lg:gap-x-12 lg:gap-y-10">
          <div className="order-1 flex min-w-0 flex-col gap-7 lg:col-start-1 lg:row-start-1">
            <div className="flex flex-col gap-3">
              <h1 className="font-heading text-3xl font-bold leading-tight text-green-deep sm:text-4xl md:text-5xl">
                India&apos;s Gateway to Global Trade
              </h1>
              <p className="max-w-md text-sm leading-6 text-foreground/80 sm:text-base sm:leading-7">
                Connecting Assam to the world.
              </p>
            </div>

            <HeroSearch />

            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
              <Button
                size="lg"
                className="w-full rounded-full sm:w-auto"
                render={<Link href="/buy-requirements/new" />}
                nativeButton={false}
              >
                Post Buy Requirement
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-full border-green bg-transparent text-green hover:bg-green/10 sm:w-auto"
                render={<Link href="/list-business" />}
                nativeButton={false}
              >
                List Your Business Free
              </Button>
            </div>
          </div>

          <div className="order-2 flex items-center justify-center lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <Image
              src="/hero_section.webp"
              alt="Agarwood, spices, and essential oils from Assam"
              width={1254}
              height={1254}
              className="h-auto w-full max-w-[280px] object-contain sm:max-w-sm lg:max-w-md"
              priority
            />
          </div>

          <div className="order-3 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-green-deep/15 pt-6 lg:col-start-1 lg:row-start-2">
            {VALUE_PROPS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green text-primary-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold text-green-deep sm:text-sm">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full bg-background">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
          <h2 className="mb-8 font-heading text-2xl font-bold text-green-deep sm:mb-10 sm:text-3xl">
            Get a free listing in 3 simple steps
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
            {LISTING_STEPS.map(({ number, icon: Icon, title, description }) => (
              <div key={number} className="flex flex-col items-center gap-3 text-center">
                <div className="relative flex size-16 items-center justify-center rounded-full bg-green-wash text-green-deep">
                  <Icon className="size-7" aria-hidden="true" />
                  <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-green text-xs font-bold text-primary-foreground">
                    {number}
                  </span>
                </div>
                <h3 className="font-heading text-base font-semibold text-green-deep">{title}</h3>
                <p className="max-w-[220px] text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {categories && categories.length > 0 && (
        <section className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
          <div className="mb-6 flex flex-col gap-1 sm:mb-8">
            <h2 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">
              Shop by Category
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Browse the directory by product category.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
            {categories.map((category) => (
              <Link key={category.id} href={`/products?category=${category.slug}`}>
                <CategoryTile
                  name={category.name}
                  count={category.productCount}
                  imageUrl={category.imageUrl}
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {featuredProducts && featuredProducts.length > 0 && (
        <section className="w-full bg-bg-soft">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
            <div className="mb-6 flex flex-col items-start gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">
                  Featured Products
                </h2>
                <p className="text-sm text-muted-foreground sm:text-base">
                  Real listings from verified exporters on the directory.
                </p>
              </div>
              <Link
                href="/products"
                className="text-sm font-semibold text-green transition-colors hover:text-green-deep"
              >
                View all products &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  slug={product.slug}
                  name={product.name}
                  imageUrl={product.imageUrl}
                  companyName={product.companyName}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {featuredExporters && featuredExporters.length > 0 && (
        <section className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
          <div className="mb-6 flex flex-col items-start gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">
                Featured Exporters
              </h2>
              <p className="text-sm text-muted-foreground sm:text-base">
                Suppliers already trading on ExportsAssam.
              </p>
            </div>
            <Link
              href="/companies"
              className="text-sm font-semibold text-green transition-colors hover:text-green-deep"
            >
              View all companies &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {featuredExporters.map((exporter) => (
              <ExporterCard
                key={exporter.id}
                slug={exporter.slug}
                name={exporter.name}
                logoUrl={exporter.logoUrl}
                location={exporter.location}
                verified={exporter.verified}
              />
            ))}
          </div>
        </section>
      )}

      {latestBuyRequirements && latestBuyRequirements.length > 0 && (
        <section className="w-full bg-bg-soft">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
            <div className="mb-6 flex flex-col gap-1 sm:mb-8">
              <h2 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">
                Latest Buy Requirements
              </h2>
              <p className="text-sm text-muted-foreground sm:text-base">
                What buyers are looking for right now.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {latestBuyRequirements.map((requirement) => (
                <BuyRequirementCard
                  key={requirement.id}
                  productText={requirement.productText}
                  quantity={requirement.quantity}
                  location={requirement.location}
                  createdAt={requirement.createdAt}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="w-full bg-green">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-4 px-4 py-12 text-center sm:gap-5 sm:px-6 sm:py-16">
          <h2 className="font-heading text-2xl font-bold text-primary-foreground sm:text-3xl">
            Join ExportsAssam Free
          </h2>
          <p className="max-w-md text-sm leading-6 text-primary-foreground sm:text-base">
            List your business, get discovered by verified buyers worldwide,
            and grow your export trade &mdash; no cost to get started.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="rounded-full"
            render={<Link href="/list-business" />}
            nativeButton={false}
          >
            List Your Business Free
          </Button>
        </div>
      </section>
    </main>
  );
}

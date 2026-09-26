import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Globe,
  MessageCircle,
  PlusCircle,
  SearchX,
  ShieldCheck,
  Sparkles,
  Store,
  X,
  Zap,
} from "lucide-react";

import { getLatestBuyRequirements } from "@/lib/supabase/queries/home";
import { Button } from "@/components/ui/button";
import { BuyRequirementCard } from "@/components/buy-requirement-card";
import { SearchBar } from "@/components/search-bar";
import { LoadFailedState } from "@/components/load-failed-state";
import { firstParam, type SearchParamValue } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Buy Leads & RFQs | Exporters Assam",
  description:
    "See what buyers are sourcing from Assam, or post your own requirement. Our team matches each one with suitable Assam exporters and connects you on WhatsApp.",
};

// Real Supabase data, not build-time content: without a dynamic API in this
// page, Next would otherwise prerender it once and freeze that snapshot
// (same reasoning as app/page.tsx).
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: SearchParamValue }>;
};

// The board shows the newest posts only; there is no pagination yet.
const LIST_LIMIT = 100;

const POPULAR_SEARCHES = [
  "Agarwood",
  "Oud Oil",
  "Assam Tea",
  "CTC Tea",
  "Ginger",
  "Bhut Jolokia",
  "Essential Oils",
  "Turmeric",
];

const SOURCING_STEPS = [
  {
    step: "01",
    title: "Post What You Need",
    description:
      "Tell us the product, quantity, and delivery location. Choose whether it is shown publicly on this board or kept private.",
    icon: FileText,
    iconColor: "bg-green/15 text-green",
  },
  {
    step: "02",
    title: "Our Team Finds a Match",
    description:
      "The Exporters Assam team reads every requirement, public or private, and matches it with suitable exporters listed in the directory.",
    icon: ShieldCheck,
    iconColor: "bg-green-deep/10 text-green-deep",
  },
  {
    step: "03",
    title: "Talk on WhatsApp",
    description:
      "We introduce you to the exporter on WhatsApp. Pricing, samples, and the deal are agreed between you; the platform takes no commission.",
    icon: MessageCircle,
    iconColor: "bg-gold/15 text-gold",
  },
];

const SOURCING_CATEGORIES = [
  {
    title: "Agarwood & Pure Oud",
    desc: "Wild and plantation chips, dehn al oud oil, incense & craftwood.",
    query: "Agarwood",
    icon: "🪵",
  },
  {
    title: "Assam Tea (CTC & Orthodox)",
    desc: "Single-estate whole leaf, Golden tips, BOP, and bulk export blends.",
    query: "Tea",
    icon: "🍵",
  },
  {
    title: "Native Spices & Herbs",
    desc: "Ghost Pepper (Bhut Jolokia), Karbi Ginger, Lakadong Turmeric.",
    query: "Spices",
    icon: "🌶️",
  },
  {
    title: "Essential Oils & Botanicals",
    desc: "Distilled Citronella, Lemongrass, Patchouli, and herbal extracts.",
    query: "Essential Oils",
    icon: "🌿",
  },
];

export default async function BuyRequirementsPage({ searchParams }: Props) {
  const q = firstParam((await searchParams).q);
  const buyRequirements = await getLatestBuyRequirements(LIST_LIMIT, q);
  const hasRequirements = buyRequirements && buyRequirements.length > 0;

  return (
    <main className="flex flex-1 flex-col bg-bg-soft/70">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero Header Section */}
        <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-green-wash/90 via-green-wash/40 to-background p-6 shadow-xs sm:p-10">
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-2xl flex-col gap-3">
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-green/20 bg-background/90 px-3.5 py-1 text-xs font-semibold text-green-deep shadow-2xs backdrop-blur-xs">
                <span className="size-2 rounded-full bg-green animate-pulse" />
                <span>Live B2B Sourcing Board &bull; Exporters Assam</span>
              </div>

              <h1 className="font-heading text-2xl font-bold tracking-tight text-green-deep sm:text-4xl">
                Global Buy Leads &amp; RFQs
              </h1>

              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                See what buyers are looking for, or post your own requirement. Our team matches each
                requirement with suitable Assam exporters and connects you on WhatsApp.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-medium text-green-deep">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/80 px-2.5 py-1 shadow-2xs border border-border/60">
                  <Zap className="size-3.5 text-gold" />
                  WhatsApp Follow Up
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/80 px-2.5 py-1 shadow-2xs border border-border/60">
                  <ShieldCheck className="size-3.5 text-green" />
                  Free for Buyers
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/80 px-2.5 py-1 shadow-2xs border border-border/60">
                  <Globe className="size-3.5 text-green-deep" />
                  Approved Assam Exporters
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
              <Button
                size="lg"
                className="rounded-xl px-6 py-5 text-sm font-semibold shadow-md shadow-green/20"
                render={<Link href="/buy-requirements/new" />}
                nativeButton={false}
              >
                <PlusCircle className="mr-2 size-4" />
                Post Buy Requirement
              </Button>

              <Link
                href="/list-business"
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-green hover:text-green-deep transition-colors"
              >
                <Store className="size-3.5" />
                <span>Are you an exporter? List your business</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Search & Filter Bar */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchBar
              placeholder="Search buy leads by product or keyword (e.g. Tea, Agarwood, Ginger)..."
              className="max-w-xl"
            />
            {q && (
              <Link
                href="/buy-requirements"
                className="inline-flex items-center gap-1 self-start text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
                Clear filter
              </Link>
            )}
          </div>

          {/* Quick Search Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Popular:</span>
            {POPULAR_SEARCHES.map((term) => (
              <Link
                key={term}
                href={`/buy-requirements?q=${encodeURIComponent(term)}`}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  q?.toLowerCase() === term.toLowerCase()
                    ? "border-green bg-green text-primary-foreground font-medium shadow-2xs"
                    : "border-border bg-background text-muted-foreground hover:border-green/50 hover:bg-green-wash/40 hover:text-green-deep"
                }`}
              >
                {term}
              </Link>
            ))}
          </div>

          {q && (
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Search results for: <strong className="text-foreground">&ldquo;{q}&rdquo;</strong>
              </span>
            </div>
          )}
        </section>

        {/* Requirements Content / Error / Empty States. getLatestBuyRequirements
            returns null when the query itself failed, which must never fall
            through to the empty-board copy below: that would tell buyers no
            one has posted anything when the truth is "we couldn't load it". */}
        {buyRequirements === null ? (
          <LoadFailedState
            what="buy requirements"
            retryHref={q ? `/buy-requirements?q=${encodeURIComponent(q)}` : "/buy-requirements"}
          />
        ) : hasRequirements ? (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Requirements ({buyRequirements.length})
              </h2>
              {buyRequirements.length === LIST_LIMIT && (
                <span className="text-xs text-muted-foreground">Showing the {LIST_LIMIT} most recent</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {buyRequirements.map((requirement) => (
                <BuyRequirementCard
                  key={requirement.id}
                  productText={requirement.productText}
                  quantity={requirement.quantity}
                  location={requirement.location}
                  createdAt={requirement.createdAt}
                />
              ))}
            </div>
          </section>
        ) : q ? (
          /* Empty State: Search yielded no results */
          <section className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-8 text-center shadow-xs sm:p-12">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <SearchX className="size-7" />
            </div>
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground sm:text-xl">
              No buy requirements found for &ldquo;{q}&rdquo;
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
              We couldn&apos;t find any active requirements matching your search. You can clear your
              search or be the first to post a sourcing request for this product.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="outline"
                className="rounded-xl"
                render={<Link href="/buy-requirements" />}
                nativeButton={false}
              >
                Clear Search
              </Button>
              <Button
                className="rounded-xl"
                render={<Link href={`/buy-requirements/new?product=${encodeURIComponent(q)}`} />}
                nativeButton={false}
              >
                <PlusCircle className="mr-1.5 size-4" />
                Post Requirement for &ldquo;{q}&rdquo;
              </Button>
            </div>
          </section>
        ) : (
          /* Default Empty State: No requirements in database yet */
          <section className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center rounded-3xl border border-border/80 bg-gradient-to-b from-background to-bg-soft/40 p-8 text-center shadow-xs sm:p-14">
            <div className="relative flex size-16 items-center justify-center rounded-2xl bg-green-wash text-green-deep ring-8 ring-green-wash/40 shadow-xs">
              <ClipboardList className="size-8" />
              <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-gold text-primary-foreground shadow-xs">
                <Sparkles className="size-3" />
              </span>
            </div>

            <h2 className="mt-5 font-heading text-xl font-bold text-green-deep sm:text-2xl">
              Be the First to Post a Sourcing Requirement
            </h2>

            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Looking for authentic Assam Agarwood, single-estate tea, organic spices, or herbal
              extracts? Post your requirement and our team will match it with suitable exporters from the
              directory and connect you on WhatsApp.
            </p>

            <div className="mt-6 flex flex-col items-center gap-3">
              <Button
                size="lg"
                className="h-auto w-full max-w-full whitespace-normal rounded-xl px-5 py-3.5 text-center text-sm font-semibold shadow-md shadow-green/20 sm:w-auto sm:px-7 sm:py-6 sm:text-base"
                render={<Link href="/buy-requirements/new" />}
                nativeButton={false}
              >
                <PlusCircle className="mr-2 size-4 sm:size-5" />
                Post Your Buy Requirement Now
              </Button>
              <span className="text-xs text-muted-foreground">
                Free for buyers &bull; Takes about a minute &bull; No commission on your deal
              </span>
            </div>

            <div className="mt-8 grid w-full grid-cols-1 gap-3 pt-6 border-t border-border/70 sm:grid-cols-3 text-left">
              <div className="flex items-start gap-2.5 rounded-xl bg-background p-3 border border-border/60">
                <CheckCircle2 className="size-4 text-green shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">WhatsApp Follow Up</span>
                  <span className="text-[11px] text-muted-foreground">Our team replies on WhatsApp</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl bg-background p-3 border border-border/60">
                <CheckCircle2 className="size-4 text-green shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">Approved Exporters</span>
                  <span className="text-[11px] text-muted-foreground">Every listed business is checked by our team</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl bg-background p-3 border border-border/60">
                <CheckCircle2 className="size-4 text-green shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">No Commission</span>
                  <span className="text-[11px] text-muted-foreground">You agree the deal directly with the exporter</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* How Sourcing Works: 3-Step Guide */}
        <section className="flex flex-col gap-6 pt-4">
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <h2 className="font-heading text-xl font-bold text-green-deep sm:text-2xl">
              How Sourcing on Exporters Assam Works
            </h2>
            <p className="text-sm text-muted-foreground">
              From your requirement to a conversation with the right exporter.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {SOURCING_STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.step}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className={`flex size-10 items-center justify-center rounded-xl ${s.iconColor}`}>
                        <Icon className="size-5" />
                      </div>
                      <span className="font-heading text-2xl font-bold text-border">
                        {s.step}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <h3 className="font-heading text-base font-semibold text-foreground">
                        {s.title}
                      </h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Popular Sourcing Categories */}
        <section className="flex flex-col gap-5 pt-4">
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <h2 className="font-heading text-xl font-bold text-green-deep sm:text-2xl">
              Popular Export Categories from Assam
            </h2>
            <p className="text-sm text-muted-foreground">
              Looking for something specific? Post a requirement in any of these regional specialties.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SOURCING_CATEGORIES.map((cat) => (
              <div
                key={cat.title}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-green/40 hover:shadow-sm"
              >
                <div className="flex flex-col gap-2.5">
                  <div className="text-2xl">{cat.icon}</div>
                  <h3 className="font-heading text-sm font-semibold text-foreground group-hover:text-green-deep transition-colors">
                    {cat.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {cat.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                  <Link
                    href={`/buy-requirements/new?product=${encodeURIComponent(cat.query)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-green hover:text-green-deep transition-colors"
                  >
                    <span>Post RFQ</span>
                    <ArrowRight className="size-3" />
                  </Link>
                  <Link
                    href={`/products?q=${encodeURIComponent(cat.query)}`}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View Products
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Supplier Invitation Banner */}
        <section className="flex flex-col items-center justify-between gap-6 rounded-3xl border border-leaf/25 bg-gradient-to-r from-green-wash/80 via-green-wash/40 to-bg-soft p-6 shadow-xs sm:flex-row sm:p-8">
          <div className="flex max-w-xl flex-col gap-2 text-center sm:text-left">
            <span className="inline-flex items-center gap-1.5 self-center sm:self-start text-xs font-semibold uppercase tracking-wider text-green-deep">
              <Store className="size-4" />
              For Assam Producers &amp; Exporters
            </span>
            <h3 className="font-heading text-lg font-bold text-green-deep sm:text-xl">
              Grow Your Export Business with Direct Buyer Leads
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              List your business in the Exporters Assam directory for free. Buyers find your products and
              send enquiries straight to your WhatsApp.
            </p>
          </div>
          <Button
            size="lg"
            className="shrink-0 rounded-xl px-6 py-5 font-semibold shadow-md shadow-green/20"
            render={<Link href="/list-business" />}
            nativeButton={false}
          >
            List Your Business Free
          </Button>
        </section>
      </div>
    </main>
  );
}

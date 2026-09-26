import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ChevronRight } from "lucide-react";

import { getCompanyBySlug } from "@/lib/supabase/queries/companies";
import { getCurrentTier } from "@/lib/supabase/queries/company-tiers";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/product-card";
import { SendEnquiryDialog } from "@/components/send-enquiry-dialog";
import { JsonLd } from "@/components/json-ld";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) return {};

  const description = company.about
    ? company.about.slice(0, 155)
    : `${company.name} on Exporters Assam, a B2B directory connecting Assam and Indian exporters with buyers worldwide.`;

  const path = `/companies/${company.slug}`;
  const title = `${company.name} | Exporters Assam`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: path,
      title,
      description,
      ...(company.logoUrl ? { images: [{ url: company.logoUrl, alt: company.name }] } : {}),
    },
  };
}

export default async function CompanyPage({ params }: Props) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const tier = await getCurrentTier(company.id);
  // Every approved product, including any whose stored image isn't on our
  // image host (imageUrl null): those still exist and are viewable, so the
  // count and the empty state must include them. The card shows a
  // placeholder for them rather than hiding the product.
  const products = company.products;

  const location = [company.location, company.country].filter(Boolean).join(", ");
  // UTC, not local: a company created just before midnight on New Year's
  // shouldn't show a different year depending on the server's timezone.
  const memberSince = company.createdAt ? new Date(company.createdAt).getUTCFullYear() : null;

  const meta = [
    location,
    `${products.length} ${products.length === 1 ? "product" : "products"}`,
    memberSince ? `Member since ${memberSince}` : null,
  ].filter(Boolean);

  const companyUrl = absoluteUrl(`/companies/${company.slug}`);
  const companyJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: company.name,
        url: companyUrl,
        ...(company.logoUrl ? { logo: company.logoUrl } : {}),
        ...(company.about ? { description: company.about } : {}),
        address: {
          "@type": "PostalAddress",
          ...(company.location ? { addressLocality: company.location } : {}),
          addressCountry: company.country,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Companies", item: absoluteUrl("/companies") },
          { "@type": "ListItem", position: 3, name: company.name, item: companyUrl },
        ],
      },
    ],
  };

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <JsonLd data={companyJsonLd} />
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-green">
            Home
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
          <Link href="/companies" className="transition-colors hover:text-green">
            Companies
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
          <span className="max-w-[200px] truncate font-medium text-foreground sm:max-w-none">{company.name}</span>
        </nav>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="h-16 w-full bg-gradient-to-r from-green-deep to-green sm:h-24" />

          <div className="flex flex-col gap-5 px-5 pb-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="-mt-10 flex size-20 shrink-0 items-center justify-center rounded-2xl border-2 border-white bg-white p-1.5 shadow-md ring-1 ring-border/50 sm:-mt-12 sm:size-24">
                {company.logoUrl ? (
                  <Image
                    src={company.logoUrl}
                    alt={company.name}
                    width={96}
                    height={96}
                    className="h-full w-full rounded-xl object-contain"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-green-wash font-heading text-3xl font-bold text-green-deep">
                    {company.name.slice(0, 1)}
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-2xl font-bold tracking-tight text-green-deep sm:text-3xl">
                    {company.name}
                  </h1>
                  {company.verified && (
                    <Badge className="h-auto gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
                      <BadgeCheck className="size-3" aria-hidden="true" />
                      Verified
                    </Badge>
                  )}
                  {(tier === "silver" || tier === "gold") && (
                    <Badge
                      variant="outline"
                      className="h-auto rounded-full px-2.5 py-1 text-xs font-medium capitalize"
                    >
                      {tier} member
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
              </div>
            </div>

            <SendEnquiryDialog target={{ type: "company", companyId: company.id, companyName: company.name }} />
          </div>
        </section>

        {company.about && (
          <section className="flex max-w-3xl flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">About</h2>
            <p className="text-sm leading-relaxed text-foreground/80 sm:text-base">{company.about}</p>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold text-green-deep">
            Products <span className="font-normal text-muted-foreground">({products.length})</span>
          </h2>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  slug={product.slug}
                  name={product.name}
                  imageUrl={product.imageUrl}
                  categoryName={product.categoryName}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                {company.name} hasn&apos;t listed any products yet. You can still ask them what they have.
              </p>
              <SendEnquiryDialog
                target={{ type: "company", companyId: company.id, companyName: company.name }}
                triggerLabel="Enquire About Products"
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

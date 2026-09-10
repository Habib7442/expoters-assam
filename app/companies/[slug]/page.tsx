import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";

import { getCompanyBySlug } from "@/lib/supabase/queries/companies";
import { getCurrentTier } from "@/lib/supabase/queries/company-tiers";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/product-card";
import { SendEnquiryDialog } from "@/components/send-enquiry-dialog";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) return {};

  const description = company.about
    ? company.about.slice(0, 155)
    : `${company.name}, an exporter on ExportsAssam connecting Assam and Indian exporters with buyers worldwide.`;

  return {
    title: `${company.name} | ExportsAssam`,
    description,
  };
}

export default async function CompanyPage({ params }: Props) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const tier = await getCurrentTier(company.id);
  const products = company.products.filter((product) => product.imageUrl !== null);

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-background p-6 shadow-sm sm:flex-row sm:items-center sm:gap-8">
          {company.logoUrl ? (
            <Image
              src={company.logoUrl}
              alt={company.name}
              width={96}
              height={96}
              className="size-24 shrink-0 self-center rounded-full object-cover"
            />
          ) : (
            <div className="flex size-24 shrink-0 items-center justify-center self-center rounded-full bg-green-wash text-3xl font-semibold text-green-deep">
              {company.name.slice(0, 1)}
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">{company.name}</h1>
            {(company.location ?? company.country) && (
              <span className="text-sm text-muted-foreground">{company.location ?? company.country}</span>
            )}
            <div className="flex flex-wrap gap-2">
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
            <div className="mt-2">
              <SendEnquiryDialog target={{ type: "company", companyId: company.id, companyName: company.name }} />
            </div>
          </div>
        </div>

        {company.about && (
          <div className="mt-6 rounded-2xl border border-border bg-background p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-green-deep">About</h2>
            <p className="mt-2 text-sm leading-6 text-foreground/80">{company.about}</p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-bold text-green-deep">Products</h2>
          <p className="text-sm text-muted-foreground">
            {products.length > 0
              ? `${products.length} product${products.length === 1 ? "" : "s"} from ${company.name}.`
              : `${company.name} hasn't listed any products yet.`}
          </p>
        </div>

        {products.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                slug={product.slug}
                name={product.name}
                imageUrl={product.imageUrl as string}
                companyName={company.name}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

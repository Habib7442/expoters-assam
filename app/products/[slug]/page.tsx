import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";

import { getCurrentTier } from "@/lib/supabase/queries/company-tiers";
import { getProductBySlug } from "@/lib/supabase/queries/products";
import { isR2Url } from "@/lib/storage/r2";
import { Badge } from "@/components/ui/badge";
import { SendEnquiryDialog } from "@/components/send-enquiry-dialog";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  const description = product.description
    ? product.description.slice(0, 155)
    : `${product.name} from ${product.company.name} on ExportsAssam, connecting Assam and Indian exporters with buyers worldwide.`;

  return {
    title: `${product.name} — ${product.company.name} | ExportsAssam`,
    description,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const tier = await getCurrentTier(product.company.id);
  const galleryImages = product.gallery_urls.filter((url) => url !== product.image_url);
  const images = [product.image_url, ...galleryImages].filter((url) => isR2Url(url));

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-2xl border border-border bg-background">
              {images[0] ? (
                <Image
                  src={images[0]}
                  alt={product.name}
                  width={800}
                  height={800}
                  className="h-auto w-full object-cover"
                  priority
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-green-wash text-lg font-semibold text-green-deep">
                  {product.name.slice(0, 1)}
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {images.slice(1).map((url, i) => (
                  <div
                    key={url}
                    className="size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-background"
                  >
                    <Image
                      src={url}
                      alt={`${product.name} — image ${i + 2}`}
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              {product.category && (
                <Badge
                  variant="secondary"
                  className="h-auto w-fit rounded-full px-3 py-1 text-xs font-medium"
                >
                  {product.category.name}
                </Badge>
              )}
              <h1 className="font-heading text-3xl font-bold text-green-deep sm:text-4xl">
                {product.name}
              </h1>
              {product.description && (
                <p className="text-base leading-7 text-foreground/80">{product.description}</p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
              <Link href={`/companies/${product.company.slug}`} className="flex items-center gap-3">
                {product.company.logo_url ? (
                  <Image
                    src={product.company.logo_url}
                    alt={product.company.name}
                    width={48}
                    height={48}
                    className="size-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green-wash text-sm font-semibold text-green-deep">
                    {product.company.name.slice(0, 1)}
                  </div>
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-semibold text-green-deep">
                    {product.company.name}
                  </span>
                  {product.company.location && (
                    <span className="truncate text-xs text-muted-foreground">
                      {product.company.location}
                    </span>
                  )}
                </div>
              </Link>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.company.verified && (
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
            </div>

            <SendEnquiryDialog target={{ type: "product", productId: product.id, productName: product.name }} />
          </div>
        </div>
      </div>
    </main>
  );
}

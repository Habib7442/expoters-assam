import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";

import { getCurrentTier } from "@/lib/supabase/queries/company-tiers";
import { getProductBySlug } from "@/lib/supabase/queries/products";
import { isR2Url } from "@/lib/storage/r2";
import { Badge } from "@/components/ui/badge";
import { ProductGallery } from "@/components/product-gallery";
import { SendEnquiryDialog } from "@/components/send-enquiry-dialog";
import { JsonLd } from "@/components/json-ld";
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl } from "@/lib/site";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  const description = product.description
    ? product.description.slice(0, 155)
    : `${product.name} from ${product.company.name} on Exporters Assam, connecting Assam and Indian exporters with buyers worldwide.`;

  const path = `/products/${product.slug}`;
  const title = `${product.name} from ${product.company.name} | Exporters Assam`;
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
      images: isR2Url(product.image_url) ? [{ url: product.image_url, alt: product.name }] : [DEFAULT_OG_IMAGE],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const tier = await getCurrentTier(product.company.id);
  const galleryImages = product.gallery_urls.filter((url) => url !== product.image_url);
  const images = [product.image_url, ...galleryImages].filter((url) => isR2Url(url));

  // No offers/price: prices are agreed off-platform, so none is published.
  const productJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        url: absoluteUrl(`/products/${product.slug}`),
        ...(product.description ? { description: product.description } : {}),
        ...(images.length > 0 ? { image: images } : {}),
        ...(product.category ? { category: product.category.name } : {}),
        // No brand or manufacturer: the directory only knows who lists the
        // product, and a trader is neither. If an Offer is ever published,
        // the listing company belongs in Offer.seller.
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Products", item: absoluteUrl("/products") },
          { "@type": "ListItem", position: 3, name: product.name, item: absoluteUrl(`/products/${product.slug}`) },
        ],
      },
    ],
  };

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <JsonLd data={productJsonLd} />
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <ProductGallery images={images} productName={product.name} />

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

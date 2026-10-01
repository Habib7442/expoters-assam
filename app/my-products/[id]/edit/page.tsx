import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { getMyCompany } from "@/lib/supabase/queries/companies";
import { getCategoriesWithProductCounts } from "@/lib/supabase/queries/home";
import { getMyProductForEdit } from "@/lib/supabase/queries/my-products";
import { ProductSubmissionForm } from "@/components/product-submission-form";

export const metadata: Metadata = {
  // Per-user page: nothing here for search results.
  robots: { index: false, follow: false },
  title: "Edit Product | Exporters Assam",
};

type Props = {
  params: Promise<{ id: string }>;
};

/** Edit one of the supplier's own products; saving sends it back to review (spec 0007, AC-2). */
export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: `/my-products/${id}/edit` });

  const product = await getMyProductForEdit(userId, id);
  if (!product) notFound();
  const company = await getMyCompany(userId);

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex flex-col gap-1">
          <Link href="/my-products" className="text-xs font-medium text-muted-foreground hover:underline">
            &larr; My products
          </Link>
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">Edit product</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Saving sends this product back to review. Until an admin approves the changes, it won&apos;t be shown on
            the site.
          </p>
        </div>

        {product.status === "rejected" && product.rejectionReason && (
          <div className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Why it was sent back: {product.rejectionReason}
          </div>
        )}

        {product.status === "hidden" ? (
          <Notice text="This product was hidden by the Exporters Assam team, so it can't be edited. You can still delete it from My products." />
        ) : company?.status !== "approved" ? (
          <Notice text="You can edit products once your business listing is approved." />
        ) : (
          <EditForm product={product} />
        )}
      </div>
    </main>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground shadow-sm">{text}</div>
  );
}

/** Categories are required; if they fail to load, say so instead of showing an empty choice (same as /products/new). */
async function EditForm({ product }: { product: NonNullable<Awaited<ReturnType<typeof getMyProductForEdit>>> }) {
  const categories = await getCategoriesWithProductCounts();
  if (!categories || categories.length === 0) {
    return <Notice text="We couldn't load the product categories right now. Please refresh the page in a moment." />;
  }
  return (
    <ProductSubmissionForm
      categories={categories}
      product={{
        id: product.id,
        name: product.name,
        description: product.description,
        categoryId: product.categoryId,
        imageUrls: product.imageUrls,
      }}
    />
  );
}

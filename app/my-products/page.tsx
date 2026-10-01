import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { auth } from "@clerk/nextjs/server";

import { getMyCompany } from "@/lib/supabase/queries/companies";
import { getMyProducts } from "@/lib/supabase/queries/my-products";
import { CONTACT_EMAIL } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { DeleteProductButton } from "@/components/delete-product-button";

export const metadata: Metadata = {
  // Per-user page: nothing here for search results.
  robots: { index: false, follow: false },
  title: "My Products | Exporters Assam",
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  approved: { label: "Live", className: "bg-green-wash text-green-deep" },
  pending: { label: "In review", className: "bg-amber-100 text-amber-800" },
  rejected: { label: "Needs changes", className: "bg-red-100 text-red-700" },
  hidden: { label: "Hidden by admin", className: "bg-zinc-200 text-zinc-700" },
};

/** The supplier's own products, any status, with edit and delete (spec 0007, AC-1 to AC-3). */
export default async function MyProductsPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: "/my-products" });

  const company = await getMyCompany(userId);
  const products = company ? await getMyProducts(userId) : [];
  const canEdit = company?.status === "approved";

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">My products</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Edit or delete your products. An edited product goes back to review before it&apos;s live again.
            </p>
          </div>
          {canEdit && (
            <Button className="rounded-full" render={<Link href="/products/new" />} nativeButton={false}>
              <Plus className="size-4" aria-hidden="true" />
              Add a product
            </Button>
          )}
        </div>

        {!company && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-green-deep">List your business first</h2>
            <p className="text-sm text-muted-foreground">You need a business listing before you can add products.</p>
            <Button size="lg" className="rounded-full" render={<Link href="/list-business" />} nativeButton={false}>
              List Your Business Free
            </Button>
          </div>
        )}

        {company && company.status === "hidden" && (
          <div className="mb-5 rounded-xl bg-zinc-100 p-4 text-sm text-zinc-700">
            Your business has been hidden by the Exporters Assam team, so it and its products aren&apos;t shown on the
            site. Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {CONTACT_EMAIL}
            </a>{" "}
            if you think this is a mistake.
          </div>
        )}

        {company && company.status !== "approved" && company.status !== "hidden" && (
          <div className="mb-5 rounded-xl bg-green-wash p-4 text-sm text-green-deep">
            Your business listing is {company.status === "pending" ? "in review" : "waiting for changes"}. You can edit
            products again once it&apos;s approved.{" "}
            <Link href="/list-business" className="underline">
              Check your listing
            </Link>
          </div>
        )}

        {company && products.length === 0 && (
          <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted-foreground shadow-sm">
            You haven&apos;t added any products yet.
          </div>
        )}

        {products.length > 0 && (
          <ul className="flex flex-col gap-3">
            {products.map((product) => {
              const status = STATUS_LABELS[product.status] ?? { label: product.status, className: "bg-zinc-100 text-zinc-700" };
              return (
                <li
                  key={product.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 shadow-sm sm:flex-row sm:items-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- the supplier's own pending images, not public pages */}
                  <img src={product.imageUrl} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {product.status === "approved" ? (
                        <Link href={`/products/${product.slug}`} className="truncate font-medium text-foreground hover:underline">
                          {product.name}
                        </Link>
                      ) : (
                        <span className="truncate font-medium text-foreground">{product.name}</span>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
                    </div>
                    {product.categoryName && <span className="text-xs text-muted-foreground">{product.categoryName}</span>}
                    {product.status === "rejected" && product.rejectionReason && (
                      <p className="text-xs text-red-700">Reason: {product.rejectionReason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {canEdit && product.status !== "hidden" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        render={<Link href={`/my-products/${product.id}/edit`} />}
                        nativeButton={false}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Edit
                      </Button>
                    )}
                    <DeleteProductButton productId={product.id} productName={product.name} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

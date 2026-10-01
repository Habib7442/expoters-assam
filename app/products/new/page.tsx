import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { getMyCompany } from "@/lib/supabase/queries/companies";
import { getCategoriesWithProductCounts } from "@/lib/supabase/queries/home";
import { Button } from "@/components/ui/button";
import { ProductSubmissionForm } from "@/components/product-submission-form";

export const metadata: Metadata = {
  // Per-user page: nothing here for search results (robots.txt disallows it too).
  robots: { index: false, follow: false },
  title: "Submit a Product | Exporters Assam",
  description: "List a product under your approved business on Exporters Assam.",
};

export default async function NewProductPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: "/products/new" });

  const company = await getMyCompany(userId);

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">Submit a Product</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            List a product under your business. An admin reviews every submission before it goes live.
          </p>
        </div>

        {!company && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-green-deep">List your business first</h2>
            <p className="text-sm text-muted-foreground">
              You need a business listing before you can submit a product.
            </p>
            <Button size="lg" className="rounded-full" render={<Link href="/list-business" />} nativeButton={false}>
              List Your Business Free
            </Button>
          </div>
        )}

        {company && company.status !== "approved" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-green-deep">
              {company.status === "pending"
                ? "Your business is under review"
                : company.status === "hidden"
                  ? "Your business is hidden"
                  : "Your business needs attention"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {company.status === "pending"
                ? "You can submit products once an admin approves your business listing."
                : company.status === "hidden"
                  ? "The Exporters Assam team has hidden your business, so you can't add products right now. Contact us if you think this is a mistake."
                  : "Your business listing was rejected. Fix it before you can submit products."}
            </p>
            <Button size="lg" className="rounded-full" render={<Link href="/list-business" />} nativeButton={false}>
              Check your listing status
            </Button>
          </div>
        )}

        {company && company.status === "approved" && <ApprovedForm />}
      </div>
    </main>
  );
}

/** Categories are required to submit; if they fail to load, say so instead of showing an empty choice. */
async function ApprovedForm() {
  const categories = await getCategoriesWithProductCounts();
  if (!categories || categories.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground shadow-sm">
        We couldn&apos;t load the product categories right now. Please refresh the page in a moment.
      </div>
    );
  }
  return <ProductSubmissionForm categories={categories} />;
}

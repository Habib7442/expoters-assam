import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { auth } from "@clerk/nextjs/server";

import { getMyCompany } from "@/lib/supabase/queries/companies";
import { BusinessListingForm } from "@/components/business-listing-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  // Per-user page: nothing here for search results (robots.txt disallows it too).
  robots: { index: false, follow: false },
  title: "List Your Business | Exporters Assam",
  description: "List your business on Exporters Assam and get discovered by buyers worldwide.",
};

export default async function ListBusinessPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: "/list-business" });

  const company = await getMyCompany(userId);

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">
            {company ? "Your business listing" : "List your business"}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {company
              ? "Track your listing's status here, and fix it if it needs another look."
              : "Tell buyers who you are. An admin reviews every listing before it goes live."}
          </p>
        </div>

        {!company && <BusinessListingForm mode="create" />}

        {company && company.status === "approved" && (
          <div className="mb-8 flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
            <span className="flex size-14 items-center justify-center rounded-full bg-green-wash text-green-deep">
              <BadgeCheck className="size-7" aria-hidden="true" />
            </span>
            <h2 className="font-heading text-xl font-semibold text-green-deep">Your business is live</h2>
            <p className="text-sm text-muted-foreground">
              {company.name} is approved and visible on Exporters Assam.
            </p>
            <Button size="lg" className="rounded-full" render={<Link href="/products/new" />} nativeButton={false}>
              Add a Product
            </Button>
          </div>
        )}

        {company && company.status === "pending" && (
          <div className="mb-5 rounded-xl bg-green-wash p-4 text-sm text-green-deep">
            Your listing is pending review. You can still edit it below.
          </div>
        )}

        {company && company.status === "approved" && (
          <div className="mb-5 flex flex-col gap-1">
            <h2 className="font-heading text-lg font-semibold text-green-deep">Edit your details</h2>
            <p className="text-sm text-muted-foreground">
              Saving a change sends your listing back for admin review. Until it&apos;s re-approved, your
              business and all its products are hidden from the directory and buyers can&apos;t send you
              enquiries. Saving without changing anything keeps it live.
            </p>
          </div>
        )}

        {company && (
          <BusinessListingForm
            mode="edit"
            initialValues={{
              name: company.name,
              addressLine: company.addressLine,
              location: company.location,
              state: company.state,
              postalCode: company.postalCode,
              country: company.country,
              about: company.about,
              email: company.email,
              gstNumber: company.gstNumber,
              whatsappNumber: company.whatsappNumber,
              logoUrl: company.logoUrl,
            }}
            rejectionReason={company.status === "rejected" ? company.rejectionReason : null}
          />
        )}
      </div>
    </main>
  );
}

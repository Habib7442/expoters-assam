import type { Metadata } from "next";
import Link from "next/link";

import { getLatestBuyRequirements } from "@/lib/supabase/queries/home";
import { Button } from "@/components/ui/button";
import { BuyRequirementCard } from "@/components/buy-requirement-card";

export const metadata: Metadata = {
  title: "Buy Leads | ExportsAssam",
  description: "See what buyers are currently looking to source from Assam and Indian exporters.",
};

export default async function BuyRequirementsPage() {
  const buyRequirements = await getLatestBuyRequirements(100);

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex flex-col items-start gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">Buy Leads</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              What buyers are currently looking to source.
            </p>
          </div>
          <Button size="lg" className="rounded-full" render={<Link href="/buy-requirements/new" />} nativeButton={false}>
            Post Buy Requirement
          </Button>
        </div>

        {buyRequirements && buyRequirements.length > 0 ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">No buy requirements posted yet.</p>
        )}
      </div>
    </main>
  );
}

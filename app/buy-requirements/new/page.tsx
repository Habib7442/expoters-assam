import type { Metadata } from "next";

import { getCategoriesWithProductCounts } from "@/lib/supabase/queries/home";
import { BuyRequirementForm } from "@/components/buy-requirement-form";
import { firstParam, type SearchParamValue } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Post a Buy Requirement | Exporters Assam",
  description: "Tell exporters what you're looking to buy, and hear back on WhatsApp.",
};

// Real Supabase data, not build-time content: without a dynamic API in this
// page, Next would otherwise prerender it once and freeze the category list
// (same reasoning as app/page.tsx).
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ product?: SearchParamValue }>;
};

export default async function PostBuyRequirementPage({ searchParams }: Props) {
  const categories = await getCategoriesWithProductCounts();
  const initialProductText = firstParam((await searchParams).product)?.trim() || undefined;

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">
            Post a Buy Requirement
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Tell exporters what you&apos;re looking to buy. We&apos;ll help you connect with sellers.
          </p>
        </div>
        <BuyRequirementForm categories={categories ?? []} initialProductText={initialProductText} />
      </div>
    </main>
  );
}

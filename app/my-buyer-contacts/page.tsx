import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { getMyCompany } from "@/lib/supabase/queries/companies";
import { getContactAllowance, getMyBuyerContacts, type ContactAllowance } from "@/lib/supabase/queries/buyer-contacts";
import { BuyerContactDetails } from "@/components/buyer-contact-details";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  // Per-user page: nothing here for search results.
  robots: { index: false, follow: false },
  title: "My Buyer Contacts | Exporters Assam",
};

const TIER_NAMES: Record<ContactAllowance["tier"], string> = { basic: "Basic", silver: "Silver", gold: "Gold" };

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Kolkata" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", DATE_OPTIONS);
}

/** Every buyer the supplier has unlocked, with their allowance for the plan year (spec 0009). */
export default async function MyBuyerContactsPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: "/my-buyer-contacts" });

  const company = await getMyCompany(userId);
  const approved = company?.status === "approved";
  const [allowance, contacts] = approved
    ? await Promise.all([getContactAllowance(company.id), getMyBuyerContacts(company.id)])
    : [null, []];

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">My buyer contacts</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Buyers you&apos;ve unlocked from Buy Leads. Opening one again never uses another contact.
            </p>
          </div>
          <Button className="rounded-full" render={<Link href="/buy-requirements" />} nativeButton={false}>
            Browse buy leads
          </Button>
        </div>

        {!approved && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-green-deep">
              {company ? "Your listing is waiting for approval" : "List your business first"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {company
                ? "You can contact buyers once your business listing is approved."
                : "Every approved business gets 1 buyer contact a year on the free Basic plan."}
            </p>
            {!company && (
              <Button size="lg" className="rounded-full" render={<Link href="/list-business" />} nativeButton={false}>
                List Your Business Free
              </Button>
            )}
          </div>
        )}

        {allowance && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green/20 bg-background p-4 text-sm shadow-sm sm:p-5">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-green-deep">{TIER_NAMES[allowance.tier]} plan</span>
              <span className="text-muted-foreground">
                {allowance.quota === null
                  ? `Unlimited buyer contacts. ${allowance.used} used since ${formatDate(allowance.periodStart)}.`
                  : `${allowance.used} of ${allowance.quota} buyer contact${allowance.quota === 1 ? "" : "s"} used since ${formatDate(allowance.periodStart)}. ${allowance.remaining} left.`}
              </span>
            </div>
            {allowance.tier !== "gold" && (
              <Button variant="outline" className="rounded-full border-green text-green hover:bg-green/10" render={<Link href="/membership" />} nativeButton={false}>
                Get more contacts
              </Button>
            )}
          </div>
        )}

        {approved && contacts.length === 0 && (
          <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted-foreground shadow-sm">
            You haven&apos;t unlocked any buyers yet. Open Buy Leads and tap Contact Buyer on a requirement.
          </div>
        )}

        <div className="grid gap-4">
          {contacts.map((contact) => (
            <div key={contact.buyRequirementId} className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-4 shadow-sm sm:p-5">
              <span className="text-xs text-muted-foreground">
                Unlocked {formatDate(contact.unlockedAt)} · posted {formatDate(contact.postedAt)}
              </span>
              <BuyerContactDetails contact={contact} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

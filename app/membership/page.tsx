import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Membership | ExportsAssam",
  description: "Membership plans for suppliers on ExportsAssam — more visibility, more buyers.",
};

type Tier = {
  name: string;
  price: string;
  badgeVariant: "secondary" | "default" | "gold";
  features: string[];
  cta: { label: string; href: string };
};

// Feature set from PRD Section 6. Prices are deliberately not shown here:
// the PRD marks them "to be decided by the client," so Silver/Gold point
// to a contact CTA instead of an invented number or a checkout button that
// doesn't work yet (Razorpay checkout is a separate, not-yet-built feature).
const TIERS: Tier[] = [
  {
    name: "Basic",
    price: "Free",
    badgeVariant: "secondary",
    features: [
      "Company profile page",
      "List up to 5 products",
      "Normal search placement",
      "Receive buyer enquiries",
    ],
    cta: { label: "List Your Business Free", href: "/list-business" },
  },
  {
    name: "Silver",
    price: "Contact us",
    badgeVariant: "default",
    features: [
      "Everything in Basic",
      "List up to 25 products",
      "Verified badge",
      "Higher search placement",
      "Sometimes featured on the home page",
    ],
    cta: { label: "Contact Us", href: "mailto:info@exportsassam.com?subject=Silver%20membership" },
  },
  {
    name: "Gold",
    price: "Contact us",
    badgeVariant: "gold",
    features: [
      "Everything in Silver",
      "Unlimited products",
      "Top priority search placement",
      "Always featured on the home page",
      "Priority buyer enquiries",
    ],
    cta: { label: "Contact Us", href: "mailto:info@exportsassam.com?subject=Gold%20membership" },
  },
];

export default function MembershipPage() {
  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex flex-col gap-1 text-center sm:mb-10">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">Membership Plans</h1>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
            Membership decides how visible your business is on the directory. Start free, upgrade whenever
            you&apos;re ready for more reach.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className="flex flex-col gap-5 rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-col gap-2">
                <Badge
                  variant={tier.badgeVariant === "gold" ? "secondary" : tier.badgeVariant}
                  className={
                    tier.badgeVariant === "gold"
                      ? "h-auto w-fit rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold"
                      : "h-auto w-fit rounded-full px-3 py-1 text-xs font-semibold"
                  }
                >
                  {tier.name}
                </Badge>
                <span className="font-heading text-2xl font-bold text-green-deep">{tier.price}</span>
              </div>

              <ul className="flex flex-col gap-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-foreground/80">
                    <Check className="mt-0.5 size-4 shrink-0 text-green" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                variant={tier.name === "Basic" ? "default" : "outline"}
                className={
                  tier.name === "Basic"
                    ? "mt-auto w-full rounded-full"
                    : "mt-auto w-full rounded-full border-green bg-transparent text-green hover:bg-green/10"
                }
                render={<Link href={tier.cta.href} />}
                nativeButton={false}
              >
                {tier.cta.label}
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Already approved and want to upgrade? Reach out to{" "}
          <a href="mailto:info@exportsassam.com" className="text-green underline underline-offset-2">
            info@exportsassam.com
          </a>{" "}
          and we&apos;ll take care of it.
        </p>
      </div>
    </main>
  );
}

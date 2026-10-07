import type { Metadata } from "next";
import Link from "next/link";
import { Check, MessageCircle } from "lucide-react";

import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  alternates: { canonical: "/membership" },
  title: "Membership | Exporters Assam",
  description: "Membership plans for suppliers on Exporters Assam — more visibility, more buyers.",
};

type Tier = {
  name: string;
  price: string;
  /** Shown under the price, e.g. "+ GST per year". */
  priceNote: string;
  badgeVariant: "secondary" | "default" | "gold";
  features: string[];
  /** Paid plans open WhatsApp; Basic links to the free listing form. */
  paid: boolean;
};

// Prices and buyer contact limits confirmed by the client on 2026-10-06.
// Payment is manual (spec 0008): the plan button opens WhatsApp, the
// supplier pays and sends the screenshot there, and an admin sets the plan
// from the admin app.
const TIERS: Tier[] = [
  {
    name: "Basic",
    price: "Free",
    priceNote: "Limited features",
    badgeVariant: "secondary",
    features: [
      "Company profile page",
      "List up to 5 products",
      "Normal search placement",
      "Receive buyer enquiries",
    ],
    paid: false,
  },
  {
    name: "Silver",
    price: "₹12,000",
    priceNote: "+ GST per year",
    badgeVariant: "default",
    features: [
      "Everything in Basic",
      "List up to 25 products",
      "15 buyer contacts per year",
      "Verified badge",
      "Higher search placement",
      "Sometimes featured on the home page",
    ],
    paid: true,
  },
  {
    name: "Gold",
    price: "₹23,999",
    priceNote: "+ GST per year",
    badgeVariant: "gold",
    features: [
      "Everything in Silver",
      "Unlimited products",
      "Unlimited buyer contacts",
      "Top priority search placement",
      "Always featured on the home page",
      "Priority buyer enquiries",
    ],
    paid: true,
  },
];

const STEPS = [
  "Choose Silver or Gold below. It opens a chat with us on WhatsApp.",
  "Pay for your plan. We share the payment details with you on WhatsApp.",
  "Send a screenshot of your payment to us in the same WhatsApp chat.",
  "We check your payment and upgrade your account, usually within one working day.",
];

/** A wa.me link to the platform number with the plan typed in; email when the number isn't set. */
function planWhatsappUrl(tier: Tier): string {
  const platformNumber = process.env.PLATFORM_WHATSAPP_NUMBER;
  const text = `Hi, I'd like the ${tier.name} plan (${tier.price} ${tier.priceNote}) on ${SITE_NAME}. My business name is: `;
  if (!platformNumber) {
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`${tier.name} membership`)}&body=${encodeURIComponent(text)}`;
  }
  return `https://wa.me/${platformNumber.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}

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

        <section
          aria-labelledby="how-to-upgrade"
          className="mx-auto mb-8 w-full max-w-3xl rounded-2xl border border-green/20 bg-background p-5 shadow-sm sm:mb-10 sm:p-6"
        >
          <h2 id="how-to-upgrade" className="font-heading text-lg font-semibold text-green-deep">
            How to upgrade
          </h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm text-foreground/80">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green text-xs font-semibold text-white">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Payment is not taken on this website. Please send your payment screenshot on WhatsApp so we can
            upgrade your account. List your business for free first if you haven&apos;t already.
          </p>
        </section>

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
                <div className="flex flex-col">
                  <span className="font-heading text-2xl font-bold text-green-deep">{tier.price}</span>
                  <span className="text-xs text-muted-foreground">{tier.priceNote}</span>
                </div>
              </div>

              <ul className="flex flex-col gap-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-foreground/80">
                    <Check className="mt-0.5 size-4 shrink-0 text-green" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              {tier.paid ? (
                <Button
                  size="lg"
                  className="mt-auto w-full rounded-full bg-[#25D366] text-white hover:bg-[#1EBE5A]"
                  render={<a href={planWhatsappUrl(tier)} target="_blank" rel="noopener noreferrer" />}
                  nativeButton={false}
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Get {tier.name} on WhatsApp
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="mt-auto w-full rounded-full"
                  render={<Link href="/list-business" />}
                  nativeButton={false}
                >
                  List Your Business Free
                </Button>
              )}
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Questions about a plan? Reach out to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-green underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </main>
  );
}

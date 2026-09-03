import Image from "next/image";
import Link from "next/link";
import { Globe, Handshake, ShieldCheck, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeroSearch } from "@/components/hero-search";

const CATEGORY_CHIPS = [
  "Agarwood Inoculation",
  "Live Plants",
  "Spices",
  "Essential Oils",
  "Tea",
  "Handicrafts",
];

const VALUE_PROPS = [
  { icon: Globe, label: "Global Reach" },
  { icon: ShieldCheck, label: "Verified Businesses" },
  { icon: Handshake, label: "Trusted Connections" },
  { icon: TrendingUp, label: "Grow Your Business" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-bg-soft w-full overflow-x-hidden">
      <section className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-2 sm:px-6 sm:pt-8">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORY_CHIPS.map((chip) => (
            <Badge
              key={chip}
              variant="secondary"
              className="h-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium sm:px-3 sm:py-1.5 sm:text-xs"
            >
              {chip}
            </Badge>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-8 rounded-2xl bg-green-wash px-5 py-8 sm:rounded-[28px] sm:px-10 sm:py-14 lg:grid-cols-2 lg:items-center lg:gap-x-12 lg:gap-y-10">
          <div className="order-1 flex min-w-0 flex-col gap-7 lg:col-start-1 lg:row-start-1">
            <div className="flex flex-col gap-3">
              <h1 className="font-heading text-3xl font-bold leading-tight text-green-deep sm:text-4xl md:text-5xl">
                India&apos;s Gateway to Global Trade
              </h1>
              <p className="max-w-md text-sm leading-6 text-foreground/80 sm:text-base sm:leading-7">
                Connecting Assam to the world.
              </p>
            </div>

            <HeroSearch />

            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
              <Button
                size="lg"
                className="w-full rounded-full sm:w-auto"
                render={<Link href="/buy-requirements/new" />}
                nativeButton={false}
              >
                Post Buy Requirement
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-full border-green bg-transparent text-green hover:bg-green/10 sm:w-auto"
                render={<Link href="/sign-up" />}
                nativeButton={false}
              >
                List Your Business Free
              </Button>
            </div>
          </div>

          <div className="order-2 flex items-center justify-center lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <Image
              src="/hero_section.webp"
              alt="Agarwood, spices, and essential oils from Assam"
              width={1254}
              height={1254}
              className="h-auto w-full max-w-[280px] object-contain sm:max-w-sm lg:max-w-md"
              priority
            />
          </div>

          <div className="order-3 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-green-deep/15 pt-6 lg:col-start-1 lg:row-start-2">
            {VALUE_PROPS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green text-primary-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold text-green-deep sm:text-sm">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full bg-green">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-4 px-4 py-12 text-center sm:gap-5 sm:px-6 sm:py-16">
          <h2 className="font-heading text-2xl font-bold text-primary-foreground sm:text-3xl">
            Join ExportsAssam Free
          </h2>
          <p className="max-w-md text-sm leading-6 text-primary-foreground sm:text-base">
            List your business, get discovered by verified buyers worldwide,
            and grow your export trade &mdash; no cost to get started.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="rounded-full"
            render={<Link href="/sign-up" />}
            nativeButton={false}
          >
            List Your Business Free
          </Button>
        </div>
      </section>
    </main>
  );
}

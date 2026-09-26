import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About Us | Exporters Assam",
  description:
    "Exporters Assam is a B2B trade directory by Avadi Herbs India Pvt. Ltd., connecting buyers worldwide with exporters of agarwood, tea, spices, essential oils and more from Assam and India.",
};

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">About Exporters Assam</h1>
          <p className="text-sm text-muted-foreground">Connecting Assam to the world.</p>
        </div>

        <div className="flex flex-col gap-8 text-sm leading-7 text-foreground/80 sm:text-base">
          <section className="flex flex-col gap-2">
            <p>
              Exporters Assam is a B2B trade directory that connects buyers in India and abroad with
              manufacturers, exporters and suppliers from Assam and across India. Buyers find products and
              businesses here, and every conversation continues on WhatsApp, directly between the two sides.
            </p>
            <p>
              The directory is run by Avadi Herbs India Pvt. Ltd., an Assam based company. We built it to give
              Assam&apos;s producers a professional online presence that reaches buyers beyond the region.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">What you&apos;ll find here</h2>
            <p>
              Agarwood and oud, Assam tea, spices and herbs, essential oils, bamboo products, handicrafts, food
              and agriculture products, and more. Browse by{" "}
              <Link href="/products" className="text-green underline underline-offset-2">
                product
              </Link>{" "}
              or by{" "}
              <Link href="/companies" className="text-green underline underline-offset-2">
                company
              </Link>
              , or see what buyers are{" "}
              <Link href="/buy-requirements" className="text-green underline underline-offset-2">
                looking for right now
              </Link>
              .
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">A directory, not a marketplace</h2>
            <p>
              We don&apos;t sell anything, take payments between buyers and suppliers, or charge commission on
              deals. When a buyer sends an enquiry, we save it and hand them a WhatsApp link to the supplier;
              pricing, samples and payment are agreed between the two of them. Buy requirements come to our
              own team, who match each one with suitable exporters.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">Every business is reviewed</h2>
            <p>
              Listing a business is free. Our team reviews every business listing, and every product a
              supplier submits, before it appears on the directory; a business stays hidden until it is
              approved.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button className="rounded-full" render={<Link href="/list-business" />} nativeButton={false}>
            List Your Business Free
          </Button>
          <Button
            variant="outline"
            className="rounded-full border-green bg-transparent text-green hover:bg-green/10"
            render={<Link href="/contact" />}
            nativeButton={false}
          >
            Contact Us
          </Button>
        </div>
      </div>
    </main>
  );
}

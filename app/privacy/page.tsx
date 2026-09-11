import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | ExportsAssam",
  description: "How ExportsAssam.com collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: September 11, 2026</p>
        </div>

        <div className="flex flex-col gap-8 text-sm leading-7 text-foreground/80 sm:text-base">
          <section className="flex flex-col gap-2">
            <p>
              ExportsAssam.com (&quot;ExportsAssam,&quot; &quot;we,&quot; &quot;us&quot;) is operated by Avadi Herbs
              India Pvt. Ltd. This policy explains what information we collect when you use the site, why we
              collect it, and how it&apos;s handled. It applies to buyers, suppliers, and visitors alike.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">1. Information we collect</h2>
            <p className="font-medium text-foreground">Account information</p>
            <p>
              When you sign in, your name, email address, and phone number (if provided) are managed by our
              authentication provider, Clerk. If you sign in with Google, we receive the basic profile
              information Google shares for that purpose.
            </p>
            <p className="font-medium text-foreground">Business listing information</p>
            <p>
              If you list a business, we collect your business name, logo, address, city, state, PIN code,
              country, WhatsApp number, business email, and (optionally) GST number, along with any products you
              submit — names, descriptions, categories, and images.
            </p>
            <p className="font-medium text-foreground">Enquiries and buy requirements</p>
            <p>
              When you send an enquiry or post a buy requirement, we collect your contact name, phone number,
              email (if provided), and your message.
            </p>
            <p className="font-medium text-foreground">Payment information</p>
            <p>
              Supplier membership payments are processed by Razorpay. We do not collect or store your card,
              UPI, or bank details — Razorpay handles that directly and shares only the payment status and
              reference with us.
            </p>
            <p className="font-medium text-foreground">Usage data</p>
            <p>
              We use PostHog to understand how the site is used — pages visited, searches performed, and where
              people drop off before completing an enquiry — so we can improve the directory.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">2. How we use this information</h2>
            <ul className="list-disc pl-5 [&>li]:mt-1">
              <li>To create and manage your account and business listing</li>
              <li>To review and approve business and product listings before they go live</li>
              <li>To forward buyer enquiries to the relevant supplier over WhatsApp</li>
              <li>To process supplier membership payments and manage your subscription tier</li>
              <li>To respond to support requests and platform-related communication</li>
              <li>To understand usage patterns and improve the directory</li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">3. WhatsApp forwarding</h2>
            <p>
              ExportsAssam is a directory, not a marketplace — deals happen directly between buyers and
              suppliers, off-platform. When you send an enquiry about a product or company, your contact
              details and message are forwarded to that supplier&apos;s WhatsApp number so they can respond to
              you directly. Once forwarded, that conversation happens on WhatsApp, outside our systems, and is
              governed by WhatsApp&apos;s own privacy practices.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">4. Who we share information with</h2>
            <p>We never sell your information. We share it only with:</p>
            <ul className="list-disc pl-5 [&>li]:mt-1">
              <li>The supplier you contact, when you send an enquiry (your contact details and message)</li>
              <li>
                Service providers who help us run the platform: Clerk (authentication), Supabase (database),
                Cloudflare (image storage), Razorpay (payments), and PostHog (analytics)
              </li>
              <li>Law enforcement or regulators, only when legally required to</li>
            </ul>
            <p>
              A business&apos;s email address and GST number are never shown on public pages — they&apos;re only
              visible to our admin team, for verification purposes.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">5. What&apos;s public on the directory</h2>
            <p>
              Once a business listing is approved, its name, logo, location (city, state, country), and
              WhatsApp number are visible to anyone browsing the directory — that&apos;s the point of listing.
              A submitted product or business stays private (visible only to you and our admin team) until it&apos;s
              approved.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">6. Data retention</h2>
            <p>
              We keep your account and listing information for as long as your account is active. If you delete
              your account or ask us to remove your data, we&apos;ll do so within a reasonable time, except
              where we&apos;re required to retain certain records (e.g. payment records) for legal or accounting
              purposes.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">7. Your rights</h2>
            <p>
              You can ask to access, correct, or delete the personal information we hold about you at any time
              by contacting us at{" "}
              <a href="mailto:info@exportsassam.com" className="text-green underline underline-offset-2">
                info@exportsassam.com
              </a>
              . You can also edit most of your own business listing details directly from your account.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">8. Cookies</h2>
            <p>
              We use cookies for authentication (via Clerk) and for analytics (via PostHog). These are used to
              keep you signed in and to understand how the site is used — not to sell your data to advertisers.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">9. Children&apos;s privacy</h2>
            <p>
              ExportsAssam is a B2B platform intended for business use and is not directed at children. We do
              not knowingly collect information from anyone under 18.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">10. Changes to this policy</h2>
            <p>
              We may update this policy as the platform evolves. Material changes will be reflected here with
              an updated date.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">11. Contact us</h2>
            <p>
              Questions about this policy or your data can be sent to{" "}
              <a href="mailto:info@exportsassam.com" className="text-green underline underline-offset-2">
                info@exportsassam.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

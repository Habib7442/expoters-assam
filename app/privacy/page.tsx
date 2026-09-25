import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Exporters Assam",
  description: "How Exporters Assam collects, uses, and protects your information.",
};

// TODO(client): confirm the Grievance Officer's name and a dedicated contact
// address. The DPDP Act (s. 8(10)) requires a published contact who can answer
// data-protection questions; the shared inbox stands in until then.
const GRIEVANCE_OFFICER_NAME = "Grievance Officer";
const PRIVACY_EMAIL = "info@exportsassam.com";

const DELETION_MAILTO = `mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent("Data deletion request")}`;

// TODO(client): these retention periods are proposed defaults, not yet
// confirmed. Payment records follow the 8-year Companies Act / tax record rule.
const RETENTION = [
  { what: "Enquiries and buy requirements", period: "12 months after they're submitted" },
  { what: "Business listings and products", period: "Until you delete your listing or account, then 30 days" },
  { what: "Account information", period: "Until you delete your account, then 30 days" },
  { what: "Membership payment records", period: "8 years, as required by Indian tax and company law" },
];

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: September 25, 2026</p>
        </div>

        <div className="flex flex-col gap-8 text-sm leading-7 text-foreground/80 sm:text-base">
          <section className="flex flex-col gap-2">
            <p>
              Exporters Assam (&quot;we,&quot; &quot;us&quot;) is operated by Avadi Herbs India Pvt. Ltd., the
              Data Fiduciary for the personal data described here under India&apos;s Digital Personal Data
              Protection Act, 2023 (&quot;DPDP Act&quot;). This policy explains what information we collect,
              why, how long we keep it, and the rights you have over it. It applies to buyers, suppliers, and
              visitors alike.
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
              When you send an enquiry or post a buy requirement, we collect your name, phone number, email (if
              provided), and your message or requirement details.
            </p>
            <p className="font-medium text-foreground">Payment information</p>
            <p>
              When a supplier pays for a membership, the payment is processed by Razorpay. We never collect or
              store your card, UPI, or bank details — Razorpay handles those directly and shares only the payment
              status and reference with us.
            </p>
            <p className="font-medium text-foreground">Usage data</p>
            <p>
              If we use analytics (PostHog) to understand how the site is used — pages visited, searches, and
              where people drop off — it only runs after you agree to it. You can use the site fully without
              agreeing.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">2. Your consent</h2>
            <p>
              We process your personal data on the basis of your consent, which you give by ticking the consent
              box on the form where you enter it (sending an enquiry, posting a buy requirement, or listing a
              business). Each form tells you what the details are for. Showing a buy requirement publicly is a
              separate choice, off by default.
            </p>
            <p>
              You can withdraw your consent at any time, as easily as you gave it — see{" "}
              <a href="#your-rights" className="text-green underline underline-offset-2">
                Your rights
              </a>
              . Withdrawing doesn&apos;t affect anything done before you withdrew, but it does mean we can no
              longer process that data for that purpose (for example, a withdrawn listing is taken off the
              directory).
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">3. How we use this information</h2>
            <ul className="list-disc pl-5 [&>li]:mt-1">
              <li>To create and manage your account and business listing</li>
              <li>To review and approve business and product listings before they go live</li>
              <li>To record your enquiry or buy requirement and let the relevant supplier, or our team, respond</li>
              <li>To process supplier membership payments and manage your membership tier</li>
              <li>To respond to support requests and platform-related communication</li>
              <li>To understand usage patterns and improve the directory, if you&apos;ve agreed to analytics</li>
            </ul>
            <p>We use your data only for these purposes, and collect only what each one needs.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">4. WhatsApp</h2>
            <p>
              Exporters Assam is a directory, not a marketplace — deals happen directly between buyers and
              suppliers, off-platform. When you send an enquiry, we save it and then offer you a WhatsApp link to
              the supplier with a pre-filled message (the product or company name, plus your message if you wrote
              one). Nothing is sent on WhatsApp unless you open that link and send the message yourself.
            </p>
            <p>
              If you do, the supplier receives that message along with whatever WhatsApp shows them about you —
              typically your WhatsApp profile name, and your phone number unless your WhatsApp settings (for
              example, a username with your number hidden) keep it from them. What WhatsApp reveals is controlled
              by WhatsApp and your own settings, not by us. We don&apos;t pass on the name, phone number, or email
              you typed into our form. From then on, the conversation happens on WhatsApp, outside our systems,
              and is governed by WhatsApp&apos;s own privacy practices.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">5. Who we share information with</h2>
            <p>We never sell your information. We share it only with:</p>
            <ul className="list-disc pl-5 [&>li]:mt-1">
              <li>
                The supplier you contact, only if you send them the WhatsApp message: they see that message and
                whatever WhatsApp shows them about you (see section 4)
              </li>
              <li>
                Service providers who process data on our behalf, under contract: Clerk (authentication),
                Supabase (database), Cloudflare (image storage, and Turnstile bot protection on our enquiry and
                buy requirement forms, which checks technical signals from your browser to tell people from
                automated spam — we don&apos;t store any of it), Razorpay (payments), and PostHog (analytics)
              </li>
              <li>Law enforcement or regulators, only when legally required to</li>
            </ul>
            <p>
              Some of these providers store data outside India — our database is hosted in Australia and our
              authentication provider in the United States. Transfers are made only to countries the Government
              of India has not restricted under the DPDP Act.
            </p>
            <p>
              A business&apos;s email address and GST number are never shown on public pages and are visible only
              to our admin team. The name, phone number, and email you enter on an enquiry or buy requirement
              form are stored by us and visible only to our admin team — we never show them on public pages or
              share them with suppliers. A supplier only sees your WhatsApp details if you choose to message them
              on WhatsApp, and then only what WhatsApp shows them (see section 4).
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">6. What&apos;s public on the directory</h2>
            <p>
              Once a business listing is approved, its name, logo, location (city, state, country), and
              WhatsApp number are visible to anyone browsing the directory — that&apos;s the point of listing.
              A buy requirement is only shown publicly if you choose that when posting it, and then only the
              product, quantity, and delivery location. A submitted product or business stays private (visible
              only to you and our admin team) until it&apos;s approved.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">7. How long we keep your data</h2>
            <p>We keep personal data only as long as its purpose needs it, then delete it:</p>
            <ul className="list-disc pl-5 [&>li]:mt-1">
              {RETENTION.map(({ what, period }) => (
                <li key={what}>
                  <span className="font-medium text-foreground">{what}:</span> {period}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">8. How we protect your data</h2>
            <p>
              We use access controls, encryption in transit, and restricted admin access to protect your
              data. If a personal data breach occurs, we will inform the Data
              Protection Board of India and the people affected, as the DPDP Act requires.
            </p>
          </section>

          <section id="your-rights" className="flex scroll-mt-24 flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">9. Your rights</h2>
            <p>Under the DPDP Act, you have the right to:</p>
            <ul className="list-disc pl-5 [&>li]:mt-1">
              <li>
                <span className="font-medium text-foreground">Access</span> a summary of the personal data we
                hold about you and who we&apos;ve shared it with
              </li>
              <li>
                <span className="font-medium text-foreground">Correct or update</span> it — most business
                listing details you can edit yourself from your account
              </li>
              <li>
                <span className="font-medium text-foreground">Erase</span> it, and{" "}
                <span className="font-medium text-foreground">withdraw your consent</span>
              </li>
              <li>
                <span className="font-medium text-foreground">Nominate</span> someone to exercise these rights
                on your behalf in case of death or incapacity
              </li>
              <li>
                <span className="font-medium text-foreground">Raise a grievance</span> with us, and if
                you&apos;re not satisfied with our response, complain to the Data Protection Board of India
              </li>
            </ul>
            <p>
              To use any of these rights, email{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-green underline underline-offset-2">
                {PRIVACY_EMAIL}
              </a>{" "}
              from the email or phone number you used with us. To delete your data,{" "}
              <a href={DELETION_MAILTO} className="text-green underline underline-offset-2">
                send a data deletion request
              </a>
              . We&apos;ll respond within 90 days.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">10. Grievance Officer</h2>
            <p>
              For any question or complaint about how we handle your personal data, contact our{" "}
              {GRIEVANCE_OFFICER_NAME}, Avadi Herbs India Pvt. Ltd., Assam, India, at{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-green underline underline-offset-2">
                {PRIVACY_EMAIL}
              </a>
              . We respond to every grievance within 90 days.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">11. Cookies</h2>
            <p>
              We use essential cookies for sign-in (via Clerk), which the site needs to work. Any analytics
              cookies (via PostHog) are used only if you agree to them. We never use cookies to sell your data to
              advertisers.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">12. Children&apos;s privacy</h2>
            <p>
              Exporters Assam is a B2B platform intended for business use and is not directed at children. We do
              not knowingly collect information from anyone under 18.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">13. Changes to this policy</h2>
            <p>
              We may update this policy as the platform evolves. Material changes will be reflected here with
              an updated date.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

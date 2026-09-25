import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Exporters Assam",
  description: "The terms that govern your use of Exporters Assam.",
};

export default function TermsPage() {
  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: September 11, 2026</p>
        </div>

        <div className="flex flex-col gap-8 text-sm leading-7 text-foreground/80 sm:text-base">
          <section className="flex flex-col gap-2">
            <p>
              These terms govern your use of Exporters Assam, operated by Avadi Herbs India Pvt. Ltd.
              (&quot;Exporters Assam,&quot; &quot;we,&quot; &quot;us&quot;). By creating an account, listing a
              business, submitting a product, posting a buy requirement, or sending an enquiry, you agree to
              these terms.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">1. What Exporters Assam is</h2>
            <p>
              Exporters Assam is a B2B trade directory connecting buyers and suppliers of Assam and Indian export
              goods. <strong className="text-foreground">It is a directory, not a marketplace.</strong> We do
              not process any transaction between a buyer and a supplier, we do not hold or transfer funds
              between them, and we are not a party to any deal that results from an enquiry. Every deal is
              negotiated and closed directly between buyer and supplier, off-platform, typically over WhatsApp.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">2. Eligibility and accounts</h2>
            <p>
              You must be able to form a legally binding contract to use Exporters Assam, and you&apos;re
              responsible for the accuracy of the information you provide and for keeping your account secure.
              One business listing per account. You&apos;re responsible for all activity under your account.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">3. Business and product listings</h2>
            <p>
              A submitted business listing or product stays pending, and is not visible to the public, until an
              admin reviews and approves it. We may reject a listing, request changes, or remove an approved one
              at our discretion — for example if it&apos;s inaccurate, misleading, or violates these terms.
              Editing an approved listing sends it back for re-review, and it may be temporarily unlisted from
              the public directory until it&apos;s re-approved.
            </p>
            <p>
              A &quot;Verified&quot; badge reflects that our team reviewed and approved the listing — it is not
              a guarantee of the business&apos;s legitimacy, product quality, or ability to fulfil an order, and
              buyers should exercise their own judgment before doing business with any listed supplier.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">4. Buy requirements and enquiries</h2>
            <p>
              If you choose to show a buy requirement publicly, your stated need (product, quantity, location) is
              visible to suppliers browsing the directory; your name, phone number, and email are never shown.
              Sending an enquiry saves it with us and offers you a WhatsApp link to the supplier, pre-filled with
              the product or company name and your message. The name, phone number, and email you entered on our
              form are not included. If you open the link and send the message, the supplier sees it along with
              your WhatsApp number and profile name. You&apos;re responsible for what you post and for any
              conversation that follows.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">5. Membership and payment</h2>
            <p>
              Suppliers may purchase a paid membership tier (Basic, Silver, or Gold) for enhanced visibility and
              features on the directory. Membership payments are processed securely through Razorpay. Membership
              fees are for platform features only — they are never a fee charged on any transaction between a
              buyer and a supplier, since no such transaction happens through Exporters Assam.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">6. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 [&>li]:mt-1">
              <li>List a business, product, or buy requirement that is fraudulent, fake, or misleading</li>
              <li>List goods that are illegal to trade, or misrepresent what you&apos;re offering or seeking</li>
              <li>Impersonate another business or person, or submit false verification information</li>
              <li>Scrape, mass-harvest, or resell data from the directory</li>
              <li>Use enquiries or contact details obtained through the site for unsolicited bulk messaging</li>
              <li>Interfere with the platform&apos;s normal operation or attempt to bypass its access controls</li>
            </ul>
            <p>We may suspend or remove an account or listing that violates these terms, without notice.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">7. Content you submit</h2>
            <p>
              You retain ownership of the business information, product details, and images you submit. By
              submitting them, you grant Exporters Assam a license to display them on the directory for as long as
              your listing remains active, and confirm you have the right to share them.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">8. No warranty; limitation of liability</h2>
            <p>
              Exporters Assam is provided &quot;as is.&quot; We do not guarantee the accuracy of any listing, the
              conduct of any buyer or supplier, or the outcome of any deal made after an enquiry. To the fullest
              extent permitted by law, Exporters Assam and Avadi Herbs India Pvt. Ltd. are not liable for any loss
              or dispute arising from a transaction, communication, or agreement between a buyer and a supplier
              — that relationship is exclusively between them.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">9. Changes to these terms</h2>
            <p>
              We may update these terms as the platform evolves. Continued use of Exporters Assam after a change
              means you accept the updated terms.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">10. Governing law</h2>
            <p>These terms are governed by the laws of India, without regard to conflict-of-law principles.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold text-green-deep">11. Contact us</h2>
            <p>
              Questions about these terms can be sent to{" "}
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

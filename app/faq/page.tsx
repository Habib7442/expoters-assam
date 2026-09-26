import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ | Exporters Assam",
  description:
    "Answers to common questions about Exporters Assam: contacting suppliers, posting buy requirements, listing your business, fees, and your data.",
};

type Faq = { question: string; answer: string };

// Every answer describes how the site actually behaves today; keep them in
// step with the code (and the Privacy Policy) when either changes.
const FAQ_GROUPS: { title: string; items: Faq[] }[] = [
  {
    title: "For buyers",
    items: [
      {
        question: "Is Exporters Assam free for buyers?",
        answer:
          "Yes. Browsing, sending enquiries and posting buy requirements are all free, and we take no commission on any deal.",
      },
      {
        question: "Can I buy products on the website?",
        answer:
          "No. Exporters Assam is a directory, not a shop. There is no cart or checkout. You agree pricing, samples and payment directly with the supplier.",
      },
      {
        question: "How do I contact a supplier?",
        answer:
          "Open a product or company page and tap Send Enquiry. We save your enquiry and give you a WhatsApp link to the supplier with a message already written; the chat starts when you send it.",
      },
      {
        question: "Will the supplier see my phone number or email?",
        answer:
          "Not from us. The name, phone number and email you type into our forms are never shown on the site or passed to suppliers. If you message a supplier on WhatsApp, they see whatever WhatsApp shows them about you, which is controlled by your WhatsApp settings.",
      },
      {
        question: "What happens after I post a buy requirement?",
        answer:
          "We save it and give you a WhatsApp link to our team. Our team reads every requirement and matches it with suitable exporters from the directory. You can choose to show it publicly on the Buy Leads page; only the product, quantity, location and date are ever shown.",
      },
    ],
  },
  {
    title: "For suppliers",
    items: [
      {
        question: "How do I list my business?",
        answer:
          "Create an account, then fill in your business name, address, business email, WhatsApp number and logo on the List Your Business page. Listing is free.",
      },
      {
        question: "Why isn't my business showing on the directory yet?",
        answer:
          "Our team reviews every listing before it goes live. Until it is approved, it stays hidden. You can check its status, and see the reason if it needs changes, on the List Your Business page.",
      },
      {
        question: "How do I add products?",
        answer:
          "Once your business is approved, use Add Product to submit each product with a name, category and up to five photos. Each product is reviewed before it appears.",
      },
      {
        question: "What does the Verified badge mean?",
        answer: "It means our team has reviewed and approved that business listing.",
      },
      {
        question: "What happens if I edit my listing after it is approved?",
        answer:
          "A real change sends it back for review, and your business and its products are hidden until it is re-approved. Saving without changing anything keeps it live.",
      },
      {
        question: "Are there paid plans?",
        answer:
          "Listing is free on the Basic plan. Silver and Gold plans add more visibility; to upgrade, email info@exportsassam.com.",
      },
    ],
  },
  {
    title: "Your data",
    items: [
      {
        question: "How do I delete my account and listing?",
        answer:
          "Deleting your account from your account settings also deletes your business listing, its products and its images. For anything else, email info@exportsassam.com.",
      },
      {
        question: "How long do you keep enquiries and buy requirements?",
        answer:
          "Enquiries and buy requirements are deleted automatically 12 months after they are submitted. See the Privacy Policy for details.",
      },
    ],
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  ),
};

export default function FaqPage() {
  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <script
        type="application/ld+json"
        // Static content from this file only; escape "<" so nothing can close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">Frequently Asked Questions</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Can&apos;t find your answer?{" "}
            <Link href="/contact" className="text-green underline underline-offset-2">
              Contact us
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {FAQ_GROUPS.map((group) => (
            <section key={group.title} className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-semibold text-green-deep">{group.title}</h2>
              <div className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <details
                    key={item.question}
                    className="group rounded-xl border border-border bg-card px-4 py-3 shadow-xs open:border-green/40"
                  >
                    <summary className="cursor-pointer list-none font-medium text-foreground marker:hidden">
                      <span className="flex items-center justify-between gap-3">
                        {item.question}
                        <span className="text-green transition-transform group-open:rotate-45" aria-hidden="true">
                          +
                        </span>
                      </span>
                    </summary>
                    <p className="mt-2 text-sm leading-7 text-foreground/80">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

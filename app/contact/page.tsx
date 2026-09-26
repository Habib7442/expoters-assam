import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  alternates: { canonical: "/contact" },
  title: "Contact Us | Exporters Assam",
  description: "Get in touch with the Exporters Assam team by email or WhatsApp.",
};

const CONTACT_EMAIL = "info@exportsassam.com";

/** The same number buy requirements are sent to, so the two never drift apart. */
function platformWhatsapp(): { display: string; href: string } | null {
  const number = process.env.PLATFORM_WHATSAPP_NUMBER;
  if (!number) return null;
  const digits = number.replace(/[^0-9]/g, "");
  const display = digits.startsWith("91") && digits.length === 12 ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : number;
  return { display, href: `https://wa.me/${digits}` };
}

export default function ContactPage() {
  const whatsapp = platformWhatsapp();

  return (
    <main className="flex flex-1 flex-col bg-bg-soft">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-green-deep sm:text-3xl">Contact Us</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Questions about listing your business, a buy requirement, or the directory? We&apos;re happy to help.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {whatsapp && (
            <a
              href={whatsapp.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-green/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-wash text-green-deep">
                <MessageCircle className="size-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-heading text-sm font-semibold text-foreground">WhatsApp</span>
                <span className="text-sm text-green">{whatsapp.display}</span>
                <span className="text-xs text-muted-foreground">The quickest way to reach our team</span>
              </span>
            </a>
          )}

          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-green/40"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-wash text-green-deep">
              <Mail className="size-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-heading text-sm font-semibold text-foreground">Email</span>
              <span className="text-sm text-green">{CONTACT_EMAIL}</span>
              <span className="text-xs text-muted-foreground">For listings, membership and data requests</span>
            </span>
          </a>

          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs sm:col-span-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-wash text-green-deep">
              <MapPin className="size-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-heading text-sm font-semibold text-foreground">Avadi Herbs India Pvt. Ltd.</span>
              <span className="text-sm text-muted-foreground">Assam, India</span>
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 text-sm leading-7 text-foreground/80">
          <p>
            Looking for a product? You&apos;ll usually get the fastest answer by{" "}
            <Link href="/buy-requirements/new" className="text-green underline underline-offset-2">
              posting a buy requirement
            </Link>{" "}
            or sending an enquiry straight from a product or company page.
          </p>
          <p>
            For privacy questions or complaints, see our{" "}
            <Link href="/privacy" className="text-green underline underline-offset-2">
              Privacy Policy
            </Link>
            , which names our Grievance Officer. Common questions are answered in the{" "}
            <Link href="/faq" className="text-green underline underline-offset-2">
              FAQ
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

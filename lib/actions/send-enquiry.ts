"use server";

import { z } from "zod";

import { hasValidPhoneDigitCount } from "@/lib/phone";
import { CONSENT_NOTICE_VERSION } from "@/lib/consent";
import { BOT_CHECK_FAILED_MESSAGE, readTurnstileToken, verifyTurnstile } from "@/lib/security/turnstile";
import { supabaseAdmin } from "@/lib/supabase/admin";

const contactFields = {
  name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{10,25}$/, "Enter a valid phone number")
    // The characters alone can pass with too few digits (e.g. "+++ --- 12"),
    // which the database then rejects as a server error; count the digits.
    .refine(hasValidPhoneDigitCount, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional(),
  consent: z.boolean().refine((agreed) => agreed, "Please agree to the Privacy Policy to send your enquiry"),
  turnstileToken: z.string().optional(),
};

const enquirySchema = z.discriminatedUnion("targetType", [
  z.object({
    targetType: z.literal("product"),
    productId: z.string().uuid(),
    productName: z.string().trim().min(1).max(200),
    ...contactFields,
  }),
  z.object({
    targetType: z.literal("company"),
    companyId: z.string().uuid(),
    companyName: z.string().trim().min(1).max(200),
    ...contactFields,
  }),
  z.object({
    targetType: z.literal("buy_requirement"),
    buyRequirementId: z.string().uuid(),
    productText: z.string().trim().min(1).max(300),
    ...contactFields,
  }),
]);

type EnquiryTargetType = z.infer<typeof enquirySchema>["targetType"];

export type SendEnquiryInput = z.input<typeof enquirySchema>;

export type SendEnquiryResult =
  | { ok: true; whatsappUrl: string | null }
  | {
      ok: false;
      code: "invalid_input" | "bot_check_failed" | "rate_limited" | "not_found" | "server_error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

/**
 * Validates and submits an enquiry, from a product page, a company page, or
 * a public buy requirement. Writes always go through `create_enquiry`/
 * `create_company_enquiry`/`create_buy_requirement_enquiry` (rate limiting,
 * deduplication, and the visibility check all live there, per spec 0003 and
 * its feature 9 extension), never a direct insert. On success, returns a
 * wa.me link the sender can open themselves — this project sends no
 * WhatsApp API call. A product or company enquiry links to the company's
 * own number when it has one; a reply to a buy requirement always links to
 * the platform's number (decided 2026-09-26), since the posting buyer's
 * phone is private and the client's team introduces the two sides.
 */
export async function sendEnquiry(input: SendEnquiryInput): Promise<SendEnquiryResult> {
  // Bot check first (spec 0006): before validation or any write. Only a
  // definite "failed" blocks; an unreachable Cloudflare fails open.
  if ((await verifyTurnstile(readTurnstileToken(input?.turnstileToken))) === "failed") {
    return { ok: false, code: "bot_check_failed", message: BOT_CHECK_FAILED_MESSAGE };
  }

  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      code: "invalid_input",
      message: "Please check the form and try again.",
      fieldErrors,
    };
  }

  const { name, phone, email, message } = parsed.data;

  const contact = {
    p_phone: phone,
    p_name: name,
    p_email: (email || null) as string,
    p_message: (message || null) as string,
    p_consent_notice_version: CONSENT_NOTICE_VERSION,
  };
  const target = parsed.data;

  const { data, error } =
    target.targetType === "product"
      ? await supabaseAdmin.rpc("create_enquiry", { ...contact, p_product_id: target.productId })
      : target.targetType === "company"
        ? await supabaseAdmin.rpc("create_company_enquiry", { ...contact, p_company_id: target.companyId })
        : await supabaseAdmin.rpc("create_buy_requirement_enquiry", {
            ...contact,
            p_buy_requirement_id: target.buyRequirementId,
          });

  if (error) {
    if (error.code === "P0002") {
      return { ok: false, code: "not_found", message: NOT_FOUND_MESSAGES[target.targetType] };
    }
    // Code and message only: never the buyer's name, phone, or email.
    console.error("sendEnquiry failed", { code: error.code, message: error.message });
    return {
      ok: false,
      code: "server_error",
      message: "Something went wrong on our end. Please try again in a moment.",
    };
  }

  // create_buy_requirement_enquiry returns no whatsapp_number (there is no
  // company to look one up for), so it is optional across the three RPCs.
  const row: { rate_limited: boolean; whatsapp_number?: string | null } | undefined = data?.[0];
  if (!row) {
    console.error("sendEnquiry failed: the database returned no row");
    return {
      ok: false,
      code: "server_error",
      message: "Something went wrong on our end. Please try again in a moment.",
    };
  }

  if (row.rate_limited) {
    return {
      ok: false,
      code: "rate_limited",
      message: "You've sent several enquiries recently. Please try again in an hour, or reach us directly.",
    };
  }

  if (target.targetType === "buy_requirement") {
    const platformNumber = process.env.PLATFORM_WHATSAPP_NUMBER;
    const intro =
      `Hi, I'd like to respond to buy requirement ${buyRequirementReference(target.buyRequirementId)} ` +
      `on Exporters Assam: ${target.productText}.`;
    return { ok: true, whatsappUrl: platformNumber ? buildWhatsappUrl(platformNumber, intro, message) : null };
  }

  const intro =
    target.targetType === "product"
      ? `Hi, I'm interested in ${target.productName} on Exporters Assam.`
      : `Hi, I'm interested in working with ${target.companyName} on Exporters Assam.`;
  const whatsappUrl = row.whatsapp_number ? buildWhatsappUrl(row.whatsapp_number, intro, message) : null;

  return { ok: true, whatsappUrl };
}

const NOT_FOUND_MESSAGES: Record<EnquiryTargetType, string> = {
  product: "This product is no longer available.",
  company: "This company is no longer available.",
  buy_requirement: "This buy requirement is no longer open.",
};

/**
 * The short reference the platform team sees in the WhatsApp message: the
 * first 8 characters of the requirement's id, e.g. `BR-1A2B3C4D`. The full
 * id is on the enquiry row itself (`buy_requirement_id`), so this is only a
 * human readable pointer, not a lookup key that must be unique.
 */
function buyRequirementReference(buyRequirementId: string): string {
  return `BR-${buyRequirementId.slice(0, 8).toUpperCase()}`;
}

function buildWhatsappUrl(whatsappNumber: string, intro: string, senderMessage?: string): string {
  const text = senderMessage ? `${intro} ${senderMessage}` : intro;
  const number = whatsappNumber.replace(/^\+/, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

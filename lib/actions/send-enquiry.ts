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
]);

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
 * Validates and submits a buyer's enquiry, from a product page or a company
 * page. Writes always go through `create_enquiry`/`create_company_enquiry`
 * (rate limiting, deduplication, and the approval check all live there, per
 * spec 0003 and its feature 9 extension), never a direct insert. On
 * success, when the company has a WhatsApp number on file, returns a wa.me
 * link the buyer can open themselves — this project sends no WhatsApp API
 * call.
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

  const { data, error } =
    parsed.data.targetType === "product"
      ? await supabaseAdmin.rpc("create_enquiry", {
          p_phone: phone,
          p_name: name,
          p_email: (email || null) as string,
          p_product_id: parsed.data.productId,
          p_message: (message || null) as string,
          p_consent_notice_version: CONSENT_NOTICE_VERSION,
        })
      : await supabaseAdmin.rpc("create_company_enquiry", {
          p_phone: phone,
          p_name: name,
          p_email: (email || null) as string,
          p_company_id: parsed.data.companyId,
          p_message: (message || null) as string,
          p_consent_notice_version: CONSENT_NOTICE_VERSION,
        });

  if (error) {
    if (error.code === "P0002") {
      const notFoundMessage =
        parsed.data.targetType === "product"
          ? "This product is no longer available."
          : "This company is no longer available.";
      return { ok: false, code: "not_found", message: notFoundMessage };
    }
    // Code and message only: never the buyer's name, phone, or email.
    console.error("sendEnquiry failed", { code: error.code, message: error.message });
    return {
      ok: false,
      code: "server_error",
      message: "Something went wrong on our end. Please try again in a moment.",
    };
  }

  const row = data?.[0];
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

  const targetName = parsed.data.targetType === "product" ? parsed.data.productName : parsed.data.companyName;
  const whatsappUrl = row.whatsapp_number
    ? buildWhatsappUrl(row.whatsapp_number, targetName, parsed.data.targetType, message)
    : null;

  return { ok: true, whatsappUrl };
}

function buildWhatsappUrl(
  whatsappNumber: string,
  targetName: string,
  targetType: "product" | "company",
  buyerMessage?: string,
): string {
  const intro =
    targetType === "product"
      ? `Hi, I'm interested in ${targetName} on Exporters Assam.`
      : `Hi, I'm interested in working with ${targetName} on Exporters Assam.`;
  const text = buyerMessage ? `${intro} ${buyerMessage}` : intro;
  const number = whatsappNumber.replace(/^\+/, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

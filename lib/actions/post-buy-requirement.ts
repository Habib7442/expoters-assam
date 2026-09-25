"use server";

import { z } from "zod";

import { CONSENT_NOTICE_VERSION } from "@/lib/consent";
import { BOT_CHECK_FAILED_MESSAGE, readTurnstileToken, verifyTurnstile } from "@/lib/security/turnstile";
import { supabaseAdmin } from "@/lib/supabase/admin";

const buyRequirementSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{10,20}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  categoryId: z.string().trim().uuid().optional().or(z.literal("")),
  productText: z.string().trim().min(2, "Tell us what you're looking to buy").max(300),
  quantity: z.string().trim().min(1, "Enter a quantity").max(100),
  location: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  isPublic: z.boolean(),
  consent: z.boolean().refine((agreed) => agreed, "Please agree to the Privacy Policy to post your requirement"),
  turnstileToken: z.string().optional(),
});

export type PostBuyRequirementInput = z.input<typeof buyRequirementSchema>;

export type PostBuyRequirementResult =
  | { ok: true; whatsappUrl: string | null }
  | {
      ok: false;
      code: "invalid_input" | "bot_check_failed" | "rate_limited" | "server_error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

/**
 * Validates and submits a buyer's requirement. Writes always go through
 * `create_buy_requirement` (buyer resolution and rate limiting live there,
 * feature 8), never a direct insert. On success, hands the buyer a wa.me
 * link to the platform's own WhatsApp number (no per-supplier number to
 * route to here, unlike an enquiry) — same no-API pattern as
 * `sendEnquiry`, not a real outbound WhatsApp send.
 */
export async function postBuyRequirement(input: PostBuyRequirementInput): Promise<PostBuyRequirementResult> {
  // Bot check first (spec 0006): before validation or any write.
  if ((await verifyTurnstile(readTurnstileToken(input?.turnstileToken))) === "failed") {
    return { ok: false, code: "bot_check_failed", message: BOT_CHECK_FAILED_MESSAGE };
  }

  const parsed = buyRequirementSchema.safeParse(input);
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

  const { name, phone, email, categoryId, productText, quantity, location, notes, isPublic } = parsed.data;

  const { data, error } = await supabaseAdmin.rpc("create_buy_requirement", {
    p_phone: phone,
    p_name: name,
    p_email: (email || null) as string,
    p_category_id: (categoryId || null) as string,
    p_product_text: productText,
    p_quantity: quantity,
    p_location: (location || null) as string,
    p_notes: (notes || null) as string,
    p_is_public: isPublic,
    p_consent_notice_version: CONSENT_NOTICE_VERSION,
  });

  if (error) {
    if (isUnknownCategoryError(error)) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Please check the form and try again.",
        fieldErrors: { categoryId: "That category is no longer available. Choose another, or leave it blank." },
      };
    }
    return {
      ok: false,
      code: "server_error",
      message: "Something went wrong on our end. Please try again in a moment.",
    };
  }

  const row = data?.[0];
  if (!row) {
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
      message: "You've posted several requirements recently. Please try again in an hour, or reach us directly.",
    };
  }

  const platformNumber = process.env.PLATFORM_WHATSAPP_NUMBER;
  const whatsappUrl = platformNumber ? buildWhatsappUrl(platformNumber, productText, quantity, location) : null;

  return { ok: true, whatsappUrl };
}

/**
 * A well-formed category id that isn't in `categories` (deleted since the
 * form loaded, or forged) trips the buy_requirements.category_id foreign key.
 * That is bad input, not a server fault. Matching the FK violation (23503)
 * rather than pre-checking with a lookup also covers a category deleted
 * between the check and the insert.
 */
function isUnknownCategoryError(error: { code?: string; message?: string }): boolean {
  return error.code === "23503" && (error.message ?? "").includes("buy_requirements_category_id_fkey");
}

function buildWhatsappUrl(platformNumber: string, productText: string, quantity: string, location?: string): string {
  const locationPart = location ? ` in ${location}` : "";
  const text = `Hi, I just posted a buy requirement on Exporters Assam: ${productText} (qty: ${quantity})${locationPart}.`;
  const number = platformNumber.replace(/^\+/, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

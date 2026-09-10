"use server";

import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase/admin";

const contactFields = {
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{10,20}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional(),
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
      code: "invalid_input" | "rate_limited" | "not_found" | "server_error";
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
        })
      : await supabaseAdmin.rpc("create_company_enquiry", {
          p_phone: phone,
          p_name: name,
          p_email: (email || null) as string,
          p_company_id: parsed.data.companyId,
          p_message: (message || null) as string,
        });

  if (error) {
    if (error.code === "P0002") {
      const notFoundMessage =
        parsed.data.targetType === "product"
          ? "This product is no longer available."
          : "This company is no longer available.";
      return { ok: false, code: "not_found", message: notFoundMessage };
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
      ? `Hi, I'm interested in ${targetName} on ExportsAssam.`
      : `Hi, I'm interested in working with ${targetName} on ExportsAssam.`;
  const text = buyerMessage ? `${intro} ${buyerMessage}` : intro;
  const number = whatsappNumber.replace(/^\+/, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

"use server";

import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase/admin";

const enquirySchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().trim().min(1).max(200),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{10,20}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional(),
});

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
 * Validates and submits a buyer's enquiry. Writes always go through
 * `create_enquiry` (rate limiting, deduplication, and the approval check
 * all live there, per spec 0003), never a direct insert. On success, when
 * the company has a WhatsApp number on file, returns a wa.me link the
 * buyer can open themselves — this project sends no WhatsApp API call.
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

  const { productId, productName, name, phone, email, message } = parsed.data;

  const { data, error } = await supabaseAdmin.rpc("create_enquiry", {
    p_phone: phone,
    p_name: name,
    p_email: (email || null) as string,
    p_product_id: productId,
    p_message: (message || null) as string,
  });

  if (error) {
    if (error.code === "P0002" || error.message?.includes("product_not_found")) {
      return { ok: false, code: "not_found", message: "This product is no longer available." };
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

  const whatsappUrl = row.whatsapp_number
    ? buildWhatsappUrl(row.whatsapp_number, productName, message)
    : null;

  return { ok: true, whatsappUrl };
}

function buildWhatsappUrl(whatsappNumber: string, productName: string, buyerMessage?: string): string {
  const intro = `Hi, I'm interested in ${productName} on ExportsAssam.`;
  const text = buyerMessage ? `${intro} ${buyerMessage}` : intro;
  const number = whatsappNumber.replace(/^\+/, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

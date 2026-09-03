"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const whatsappNumber = z
  .string()
  .trim()
  .min(1, "Enter your WhatsApp number")
  .refine((value) => {
    const digits = value.replace(/[^0-9]/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Enter a valid WhatsApp number, with country code if outside India");

const baseFields = {
  name: z.string().trim().min(2, "Enter your business name").max(200),
  location: z.string().trim().min(2, "Enter a location").max(120),
  about: z.string().trim().max(2000).optional(),
  email: z.string().trim().min(1, "Enter your business email").email("Enter a valid email address"),
  whatsappNumber,
};

const createSchema = z.object({
  ...baseFields,
  logo: z
    .instanceof(File)
    .refine((file) => file.size > 0, "Upload your business logo")
    .refine((file) => file.size <= MAX_LOGO_BYTES, "Logo must be under 2 MB")
    .refine((file) => file.type in ALLOWED_LOGO_TYPES, "Logo must be a JPG, PNG, or WebP image"),
});

const updateSchema = z.object({
  ...baseFields,
  logo: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_LOGO_BYTES, "Logo must be under 2 MB")
    .refine((file) => file.size === 0 || file.type in ALLOWED_LOGO_TYPES, "Logo must be a JPG, PNG, or WebP image")
    .optional()
    .transform((file) => (file && file.size > 0 ? file : undefined)),
});

export type BusinessListingResult =
  | { ok: true; companyId: string; status: string }
  | {
      ok: false;
      code:
        | "not_signed_in"
        | "invalid_input"
        | "already_listed"
        | "not_editable"
        | "not_found"
        | "rate_limited"
        | "upload_failed"
        | "server_error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

function collectFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

async function uploadLogo(clerkUserId: string, file: File): Promise<string> {
  const ext = ALLOWED_LOGO_TYPES[file.type];
  const path = `${clerkUserId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from("company-logos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = supabaseAdmin.storage.from("company-logos").getPublicUrl(path);
  return data.publicUrl;
}

/** Best effort only: an orphaned Storage object is an accepted, low cost tradeoff (spec 0005). */
async function deleteLogoBestEffort(logoUrl: string): Promise<void> {
  try {
    const marker = "/company-logos/";
    const index = logoUrl.indexOf(marker);
    if (index === -1) return;
    const path = logoUrl.slice(index + marker.length);
    await supabaseAdmin.storage.from("company-logos").remove([path]);
  } catch {
    // best effort only
  }
}

const GENERIC_ERROR: BusinessListingResult = {
  ok: false,
  code: "server_error",
  message: "Something went wrong on our end. Please try again in a moment.",
};

function isWhatsappCheckViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23514" && !!error.message?.includes("whatsapp_number");
}

function isEmailCheckViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23514" && !!error.message?.includes("companies_email_check");
}

const WHATSAPP_FIELD_ERROR: BusinessListingResult = {
  ok: false,
  code: "invalid_input",
  message: "Please check the form and try again.",
  fieldErrors: { whatsappNumber: "Enter a valid WhatsApp number, with country code" },
};

const EMAIL_FIELD_ERROR: BusinessListingResult = {
  ok: false,
  code: "invalid_input",
  message: "Please check the form and try again.",
  fieldErrors: { email: "Enter a valid email address" },
};

/** Creates the caller's business listing (spec 0005, AC-2, AC-3, AC-9, AC-10). */
export async function submitBusinessListing(formData: FormData): Promise<BusinessListingResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, code: "not_signed_in", message: "Please sign in first." };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
    about: formData.get("about") || undefined,
    email: formData.get("email"),
    whatsappNumber: formData.get("whatsappNumber"),
    logo: formData.get("logo"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please check the form and try again.",
      fieldErrors: collectFieldErrors(parsed.error),
    };
  }

  const { name, location, about, email, whatsappNumber: phone, logo } = parsed.data;

  let logoUrl: string;
  try {
    logoUrl = await uploadLogo(userId, logo);
  } catch {
    return { ok: false, code: "upload_failed", message: "Could not upload your logo. Please try again." };
  }

  const { data, error } = await supabaseAdmin.rpc("create_business_listing", {
    p_clerk_user_id: userId,
    p_name: name,
    p_location: location,
    p_logo_url: logoUrl,
    p_whatsapp_number: phone,
    p_about: (about || null) as string,
    p_email: email,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, code: "already_listed", message: "You already have a business listed." };
    }
    if (isWhatsappCheckViolation(error)) return WHATSAPP_FIELD_ERROR;
    if (isEmailCheckViolation(error)) return EMAIL_FIELD_ERROR;
    return GENERIC_ERROR;
  }

  const row = data?.[0];
  if (!row) return GENERIC_ERROR;

  revalidatePath("/list-business");
  return { ok: true, companyId: row.company_id, status: row.status };
}

/** Edits the caller's own listing while pending or rejected (spec 0005, AC-5, AC-6). */
export async function updateBusinessListing(formData: FormData): Promise<BusinessListingResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, code: "not_signed_in", message: "Please sign in first." };
  }

  const parsed = updateSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
    about: formData.get("about") || undefined,
    email: formData.get("email"),
    whatsappNumber: formData.get("whatsappNumber"),
    logo: formData.get("logo"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please check the form and try again.",
      fieldErrors: collectFieldErrors(parsed.error),
    };
  }

  const { name, location, about, email, whatsappNumber: phone, logo } = parsed.data;

  const { data: existing } = await supabaseAdmin
    .from("companies")
    .select("logo_url")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (logo) {
    try {
      logoUrl = await uploadLogo(userId, logo);
    } catch {
      return { ok: false, code: "upload_failed", message: "Could not upload your logo. Please try again." };
    }
  }

  const { data, error } = await supabaseAdmin.rpc("update_business_listing", {
    p_clerk_user_id: userId,
    p_name: name,
    p_location: location,
    p_logo_url: (logoUrl ?? null) as string,
    p_whatsapp_number: phone,
    p_about: (about || null) as string,
    p_email: email,
  });

  if (error) {
    if (error.code === "P0004") {
      return { ok: false, code: "not_found", message: "No business listing found for your account." };
    }
    if (error.code === "P0005") {
      return { ok: false, code: "not_editable", message: "An approved listing can't be edited here yet." };
    }
    if (error.code === "P0006") {
      return {
        ok: false,
        code: "rate_limited",
        message: "You've just saved a change. Please wait a moment before saving again.",
      };
    }
    if (isWhatsappCheckViolation(error)) return WHATSAPP_FIELD_ERROR;
    if (isEmailCheckViolation(error)) return EMAIL_FIELD_ERROR;
    return GENERIC_ERROR;
  }

  const row = data?.[0];
  if (!row) return GENERIC_ERROR;

  if (logoUrl && existing?.logo_url && existing.logo_url !== logoUrl) {
    void deleteLogoBestEffort(existing.logo_url);
  }

  revalidatePath("/list-business");
  return { ok: true, companyId: row.company_id, status: row.status };
}

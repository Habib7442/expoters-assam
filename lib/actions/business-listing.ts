"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CONSENT_NOTICE_VERSION } from "@/lib/consent";
import { readVerifiedImage, type VerifiedImage } from "@/lib/image-signature";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deleteFromR2, parseR2Url, uploadToR2 } from "@/lib/storage/r2";

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
  addressLine: z.string().trim().min(5, "Enter your business address").max(240),
  location: z.string().trim().min(2, "Enter a city").max(120),
  state: z.string().trim().min(2, "Enter a state").max(120),
  postalCode: z
    .string()
    .trim()
    .max(12, "Enter a valid PIN code")
    .optional(),
  country: z.string().trim().min(2, "Enter a country").max(120),
  about: z.string().trim().max(2000).optional(),
  email: z.string().trim().min(1, "Enter your business email").email("Enter a valid email address"),
  whatsappNumber,
  gstNumber: z
    .string()
    .trim()
    .max(20, "Enter a valid GST number")
    .optional(),
};

const createSchema = z.object({
  ...baseFields,
  consent: z.literal("on", { error: "Please agree to the Privacy Policy to submit your listing" }),
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

const INVALID_LOGO_RESULT: BusinessListingResult = {
  ok: false,
  code: "invalid_input",
  message: "Please check the form and try again.",
  fieldErrors: { logo: "Logo must be a JPG, PNG, or WebP image" },
};

/** Stores the verified bytes under their detected type, never the browser-claimed one. */
async function uploadLogo(clerkUserId: string, image: VerifiedImage): Promise<string> {
  const key = `${clerkUserId}/${crypto.randomUUID()}.${image.ext}`;
  return uploadToR2("logos", key, image.buffer, image.type);
}

/** Best effort only: an orphaned R2 object is an accepted, low cost tradeoff (spec 0005). */
async function deleteLogoBestEffort(logoUrl: string): Promise<void> {
  try {
    const parsed = parseR2Url(logoUrl);
    if (!parsed) return;
    await deleteFromR2(parsed.category, parsed.key);
  } catch {
    // best effort only
  }
}

const GENERIC_ERROR: BusinessListingResult = {
  ok: false,
  code: "server_error",
  message: "Something went wrong on our end. Please try again in a moment.",
};

const ALREADY_LISTED_RESULT: BusinessListingResult = {
  ok: false,
  code: "already_listed",
  message: "You already have a business listed.",
};

const RATE_LIMITED_RESULT: BusinessListingResult = {
  ok: false,
  code: "rate_limited",
  message: "You've just saved a change. Please wait a moment before saving again.",
};

type ExistingListing = {
  name: string;
  address_line: string | null;
  location: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  about: string | null;
  email: string | null;
  gst_number: string | null;
  company_contacts: { whatsapp_number: string } | null;
};

type ListingFields = {
  name: string;
  addressLine: string;
  location: string;
  state: string;
  postalCode?: string;
  country: string;
  about?: string;
  email: string;
  whatsappNumber: string;
  gstNumber?: string;
};

/** True when a submitted edit matches what is already stored (WhatsApp compared by digits, since it is stored normalized). */
function isUnchanged(existing: ExistingListing, next: ListingFields): boolean {
  const same = (stored: string | null, submitted: string | undefined) => (stored ?? "") === (submitted ?? "");
  const digits = (value: string | null | undefined) => (value ?? "").replace(/[^0-9]/g, "");
  return (
    existing.name === next.name &&
    same(existing.address_line, next.addressLine) &&
    same(existing.location, next.location) &&
    same(existing.state, next.state) &&
    same(existing.postal_code, next.postalCode) &&
    existing.country === next.country &&
    same(existing.about, next.about) &&
    same(existing.email, next.email) &&
    same(existing.gst_number, next.gstNumber) &&
    digits(existing.company_contacts?.whatsapp_number) === digits(next.whatsappNumber)
  );
}

/** Must match update_business_listing's own cooldown (P0006). */
const EDIT_COOLDOWN_MS = 10_000;

/** Only the one-company-per-user constraint means "already listed"; any other 23505 (e.g. a slug) does not. */
function isAlreadyListedViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" && !!error.message?.includes("companies_clerk_user_id_key");
}

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
    addressLine: formData.get("addressLine"),
    location: formData.get("location"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode") || undefined,
    country: formData.get("country"),
    about: formData.get("about") || undefined,
    email: formData.get("email"),
    whatsappNumber: formData.get("whatsappNumber"),
    gstNumber: formData.get("gstNumber") || undefined,
    logo: formData.get("logo"),
    consent: formData.get("consent"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please check the form and try again.",
      fieldErrors: collectFieldErrors(parsed.error),
    };
  }

  const {
    name,
    addressLine,
    location,
    state,
    postalCode,
    country,
    about,
    email,
    whatsappNumber: phone,
    gstNumber,
    logo,
  } = parsed.data;

  // Refuse a second listing before uploading anything: otherwise every
  // repeat submit writes a logo to R2 and only then fails on the one
  // company per user constraint. The database constraint stays the real
  // guard against a race; this only saves the upload.
  const { data: alreadyListed, error: lookupError } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (lookupError) return GENERIC_ERROR;
  if (alreadyListed) return ALREADY_LISTED_RESULT;

  const logoImage = await readVerifiedImage(logo);
  if (!logoImage) return INVALID_LOGO_RESULT;

  let logoUrl: string;
  try {
    logoUrl = await uploadLogo(userId, logoImage);
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
    p_gst_number: (gstNumber || null) as string,
    p_state: state,
    p_country: country,
    p_address_line: addressLine,
    p_postal_code: (postalCode || null) as string,
    p_consent_notice_version: CONSENT_NOTICE_VERSION,
  });

  const row = data?.[0];
  if (error || !row) {
    // Nothing points at the logo we just uploaded; don't leave it in R2.
    await deleteLogoBestEffort(logoUrl);
    if (!error) return GENERIC_ERROR;
    if (isAlreadyListedViolation(error)) return ALREADY_LISTED_RESULT;
    if (isWhatsappCheckViolation(error)) return WHATSAPP_FIELD_ERROR;
    if (isEmailCheckViolation(error)) return EMAIL_FIELD_ERROR;
    return GENERIC_ERROR;
  }

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
    addressLine: formData.get("addressLine"),
    location: formData.get("location"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode") || undefined,
    country: formData.get("country"),
    about: formData.get("about") || undefined,
    email: formData.get("email"),
    whatsappNumber: formData.get("whatsappNumber"),
    gstNumber: formData.get("gstNumber") || undefined,
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

  const {
    name,
    addressLine,
    location,
    state,
    postalCode,
    country,
    about,
    email,
    whatsappNumber: phone,
    gstNumber,
    logo,
  } = parsed.data;

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("companies")
    .select(
      "id, logo_url, status, updated_at, name, address_line, location, state, postal_code, country, about, email, gst_number, company_contacts(whatsapp_number)",
    )
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (lookupError) return GENERIC_ERROR;
  if (!existing) return { ok: false, code: "not_found", message: "No business listing found for your account." };

  // A save that changes nothing must not send an approved listing (and with
  // it every product and enquiry path) back into review.
  if (!logo && isUnchanged(existing, parsed.data)) {
    return { ok: true, companyId: existing.id, status: existing.status };
  }

  // Checked here too, before any upload: the database cooldown (P0006) only
  // limits database writes, not the R2 upload that would come first.
  if (existing.updated_at && Date.now() - new Date(existing.updated_at).getTime() < EDIT_COOLDOWN_MS) {
    return RATE_LIMITED_RESULT;
  }

  let logoUrl: string | null = null;
  if (logo) {
    const logoImage = await readVerifiedImage(logo);
    if (!logoImage) return INVALID_LOGO_RESULT;
    try {
      logoUrl = await uploadLogo(userId, logoImage);
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
    p_gst_number: (gstNumber || null) as string,
    p_state: state,
    p_country: country,
    p_address_line: addressLine,
    p_postal_code: (postalCode || null) as string,
  });

  const row = data?.[0];
  if (error || !row) {
    // The new logo never got attached to the listing; don't leave it in R2.
    if (logoUrl) await deleteLogoBestEffort(logoUrl);
    if (!error) return GENERIC_ERROR;
    if (error.code === "P0004") {
      return { ok: false, code: "not_found", message: "No business listing found for your account." };
    }
    if (error.code === "P0006") return RATE_LIMITED_RESULT;
    if (isWhatsappCheckViolation(error)) return WHATSAPP_FIELD_ERROR;
    if (isEmailCheckViolation(error)) return EMAIL_FIELD_ERROR;
    return GENERIC_ERROR;
  }

  if (logoUrl && existing.logo_url && existing.logo_url !== logoUrl) {
    void deleteLogoBestEffort(existing.logo_url);
  }

  revalidatePath("/list-business");
  return { ok: true, companyId: row.company_id, status: row.status };
}

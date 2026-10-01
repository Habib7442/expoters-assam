"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { cleanupUploadedImages, imageFile, MAX_IMAGES, uploadProductImages } from "@/lib/product-images";
import { supabaseAdmin } from "@/lib/supabase/admin";

const submitProductSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name").max(200),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.string().trim().uuid("Choose a category"),
  images: z.array(imageFile).min(1, "Add at least one image").max(MAX_IMAGES, `Up to ${MAX_IMAGES} images`),
});

export type SubmitProductInput = {
  name: string;
  description?: string;
  categoryId: string;
  images: File[];
};

export type SubmitProductResult =
  | { ok: true; productId: string; status: string }
  | {
      ok: false;
      code:
        | "not_signed_in"
        | "invalid_input"
        | "company_not_approved"
        | "rate_limited"
        | "upload_failed"
        | "server_error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

const NOT_APPROVED_RESULT: SubmitProductResult = {
  ok: false,
  code: "company_not_approved",
  message: "Your business needs to be approved before you can submit products.",
};

/** Must match create_product_submission's P0010 cap (20260925050000). */
const PRODUCTS_PER_HOUR = 30;

const RATE_LIMITED_RESULT: SubmitProductResult = {
  ok: false,
  code: "rate_limited",
  message: `You've submitted ${PRODUCTS_PER_HOUR} products in the last hour. Please wait a little before adding more.`,
};

const SERVER_ERROR_RESULT: SubmitProductResult = {
  ok: false,
  code: "server_error",
  message: "Something went wrong on our end. Please try again in a moment.",
};

/**
 * Creates a pending product submission for the signed in supplier's own
 * (already approved) company. Images upload to R2 before the database
 * write, same `{clerkUserId}/{uuid}.{ext}` key scheme as the business
 * listing logo (spec 0004's Follow-up named this convention ahead of time).
 *
 * Checks the company is approved *before* uploading anything (avoids
 * uploading straight to R2 for the common case of a not-yet-approved
 * caller), but `create_product_submission`'s own P0007 gate still runs too
 * — this preflight can't be trusted alone against a race where the
 * company's status changes between this check and the insert. Every
 * generated R2 key is tracked so a failed upload or a failed/rejected RPC
 * call cleans up whatever already made it to R2, rather than leaving those
 * objects orphaned with no product row ever pointing at them.
 */
export async function submitProduct(input: SubmitProductInput): Promise<SubmitProductResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, code: "not_signed_in", message: "Please sign in first." };
  }

  const parsed = submitProductSchema.safeParse(input);
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

  const { name, description, categoryId, images } = parsed.data;

  const { data: company, error: companyError } = await supabaseAdmin
    .from("companies")
    .select("id, status")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (companyError) return SERVER_ERROR_RESULT;
  if (!company || company.status !== "approved") return NOT_APPROVED_RESULT;

  // Early exit before any R2 upload (spec 0006, AC-6). Only a preflight:
  // create_product_submission's own locked count (P0010) is authoritative.
  const { count: recentCount, error: countError } = await supabaseAdmin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (countError) return SERVER_ERROR_RESULT;
  if ((recentCount ?? 0) >= PRODUCTS_PER_HOUR) return RATE_LIMITED_RESULT;

  // Verifies every file's real bytes before uploading any (lib/product-images.ts).
  const upload = await uploadProductImages(userId, images);
  if (!upload.ok && upload.code === "invalid_images") {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please check the form and try again.",
      fieldErrors: { images: "Images must be JPG, PNG, or WebP" },
    };
  }
  if (!upload.ok) {
    return { ok: false, code: "upload_failed", message: "Could not upload your images. Please try again." };
  }
  const { urls: imageUrls, keys: uploadedKeys } = upload;

  const { data, error } = await supabaseAdmin.rpc("create_product_submission", {
    p_clerk_user_id: userId,
    p_name: name,
    p_description: (description || null) as string,
    p_category_id: categoryId,
    p_image_urls: imageUrls,
  });

  if (error) {
    await cleanupUploadedImages(uploadedKeys);
    if (error.code === "P0007") return NOT_APPROVED_RESULT;
    if (error.code === "P0010") return RATE_LIMITED_RESULT;
    return SERVER_ERROR_RESULT;
  }

  const row = data?.[0];
  if (!row) {
    await cleanupUploadedImages(uploadedKeys);
    return SERVER_ERROR_RESULT;
  }

  revalidatePath("/products/new");
  return { ok: true, productId: row.product_id, status: row.status };
}

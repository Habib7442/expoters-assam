"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadToR2 } from "@/lib/storage/r2";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 5;
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const imageFile = z
  .instanceof(File)
  .refine((file) => file.size > 0, "Choose an image")
  .refine((file) => file.size <= MAX_IMAGE_BYTES, "Each image must be under 2 MB")
  .refine((file) => file.type in ALLOWED_IMAGE_TYPES, "Images must be JPG, PNG, or WebP");

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
      code: "not_signed_in" | "invalid_input" | "company_not_approved" | "upload_failed" | "server_error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

/**
 * Creates a pending product submission for the signed in supplier's own
 * (already approved) company. Images upload to R2 before the database
 * write, same `{clerkUserId}/{uuid}.{ext}` key scheme as the business
 * listing logo (spec 0004's Follow-up named this convention ahead of time).
 * The atomicity, slug generation, and the approved-company gate all live in
 * `create_product_submission`, not here.
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

  let imageUrls: string[];
  try {
    imageUrls = await Promise.all(
      images.map(async (file) => {
        const ext = ALLOWED_IMAGE_TYPES[file.type];
        const key = `${userId}/${crypto.randomUUID()}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        return uploadToR2("products", key, buffer, file.type);
      }),
    );
  } catch {
    return { ok: false, code: "upload_failed", message: "Could not upload your images. Please try again." };
  }

  const { data, error } = await supabaseAdmin.rpc("create_product_submission", {
    p_clerk_user_id: userId,
    p_name: name,
    p_description: (description || null) as string,
    p_category_id: categoryId,
    p_image_urls: imageUrls,
  });

  if (error) {
    if (error.code === "P0007") {
      return {
        ok: false,
        code: "company_not_approved",
        message: "Your business needs to be approved before you can submit products.",
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

  revalidatePath("/products/new");
  return { ok: true, productId: row.product_id, status: row.status };
}

"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  cleanupUploadedImages,
  deleteImagesByUrl,
  imageFile,
  MAX_IMAGES,
  uploadProductImages,
} from "@/lib/product-images";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ManageProductResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "not_signed_in"
        | "invalid_input"
        | "not_found"
        | "company_not_approved"
        | "product_hidden"
        | "rate_limited"
        | "upload_failed"
        | "server_error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

const NOT_SIGNED_IN: ManageProductResult = { ok: false, code: "not_signed_in", message: "Please sign in first." };
const NOT_FOUND: ManageProductResult = {
  ok: false,
  code: "not_found",
  message: "This product no longer exists, or it isn't yours.",
};
const NOT_APPROVED: ManageProductResult = {
  ok: false,
  code: "company_not_approved",
  message: "Your business needs to be approved before you can edit products.",
};
const HIDDEN: ManageProductResult = {
  ok: false,
  code: "product_hidden",
  message: "This product was hidden by the Exporters Assam team, so it can't be edited. Contact us for help.",
};
const SERVER_ERROR: ManageProductResult = {
  ok: false,
  code: "server_error",
  message: "Something went wrong on our end. Please try again in a moment.",
};

const updateProductSchema = z
  .object({
    productId: z.string().uuid(),
    name: z.string().trim().min(2, "Enter a product name").max(200),
    description: z.string().trim().max(2000).optional(),
    categoryId: z.string().trim().uuid("Choose a category"),
    keepImageUrls: z.array(z.string().url()).max(MAX_IMAGES),
    newImages: z.array(imageFile).max(MAX_IMAGES),
  })
  .refine((input) => input.keepImageUrls.length + input.newImages.length >= 1, {
    path: ["images"],
    message: "Keep or add at least one image",
  })
  .refine((input) => input.keepImageUrls.length + input.newImages.length <= MAX_IMAGES, {
    path: ["images"],
    message: `Up to ${MAX_IMAGES} images in total`,
  });

export type UpdateProductInput = z.input<typeof updateProductSchema>;

type OwnedProduct = {
  id: string;
  slug: string;
  status: string;
  imageUrls: string[];
  companySlug: string;
  companyStatus: string;
};

/**
 * The signed in supplier's own product, or null when it doesn't exist or
 * belongs to another company: the ownership check is the `clerk_user_id`
 * filter on the joined company, so another supplier's product id simply
 * finds nothing (spec 0007, AC-4). Throws on a database error.
 */
async function getOwnedProduct(clerkUserId: string, productId: string): Promise<OwnedProduct | null> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, slug, status, image_url, gallery_urls, companies!inner(slug, status, clerk_user_id)")
    .eq("id", productId)
    .eq("companies.clerk_user_id", clerkUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    status: data.status,
    imageUrls: data.gallery_urls.length > 0 ? data.gallery_urls : [data.image_url],
    companySlug: data.companies.slug,
    companyStatus: data.companies.status,
  };
}

/** Supplier actions run in the storefront, so they refresh the cached public pages at once (spec 0007). */
function revalidateProductPages(product: Pick<OwnedProduct, "slug" | "companySlug">): void {
  revalidatePath(`/products/${product.slug}`);
  revalidatePath(`/companies/${product.companySlug}`);
  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/my-products");
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  // A bad keep/new image list is reported on the one images field.
  for (const key of ["keepImageUrls", "newImages"]) {
    if (fieldErrors[key] && !fieldErrors.images) fieldErrors.images = fieldErrors[key];
  }
  return fieldErrors;
}

/**
 * Edits one of the signed in supplier's own products (spec 0007, AC-2).
 * The supplier chooses which current images to keep and may add new ones
 * (1 to 5 in total). The product always goes back to `pending` for review.
 * Kept images must be ones the product already has, so an edit can never
 * point a product at an arbitrary URL. Images the edit dropped are removed
 * from R2 only after the database write succeeds.
 */
export async function updateProduct(input: UpdateProductInput): Promise<ManageProductResult> {
  const { userId } = await auth();
  if (!userId) return NOT_SIGNED_IN;

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please check the form and try again.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const { productId, name, description, categoryId, keepImageUrls, newImages } = parsed.data;

  let product: OwnedProduct | null;
  try {
    product = await getOwnedProduct(userId, productId);
  } catch {
    return SERVER_ERROR;
  }
  if (!product) return NOT_FOUND;
  if (product.status === "hidden") return HIDDEN;
  if (product.companyStatus !== "approved") return NOT_APPROVED;

  const currentUrls = new Set(product.imageUrls);
  if (keepImageUrls.some((url) => !currentUrls.has(url))) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please check the form and try again.",
      fieldErrors: { images: "Some images changed while you were editing. Reload the page and try again." },
    };
  }

  let newUrls: string[] = [];
  let newKeys: string[] = [];
  if (newImages.length > 0) {
    const upload = await uploadProductImages(userId, newImages);
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
    newUrls = upload.urls;
    newKeys = upload.keys;
  }

  const { error } = await supabaseAdmin.rpc("update_product_submission", {
    p_clerk_user_id: userId,
    p_product_id: productId,
    p_name: name,
    p_description: (description || null) as string,
    p_category_id: categoryId,
    p_image_urls: [...keepImageUrls, ...newUrls],
  });

  if (error) {
    await cleanupUploadedImages(newKeys);
    if (error.code === "P0002") return NOT_FOUND;
    if (error.code === "P0007") return NOT_APPROVED;
    if (error.code === "P0011") return HIDDEN;
    if (error.code === "P0006") {
      return { ok: false, code: "rate_limited", message: "You just saved this product. Wait a few seconds and try again." };
    }
    // A category deleted since the page loaded (foreign key violation).
    if (error.code === "23503") {
      return {
        ok: false,
        code: "invalid_input",
        message: "Please check the form and try again.",
        fieldErrors: { categoryId: "Choose a category" },
      };
    }
    console.error("updateProduct failed", { code: error.code, message: error.message });
    return SERVER_ERROR;
  }

  const droppedUrls = product.imageUrls.filter((url) => !keepImageUrls.includes(url));
  const failed = await deleteImagesByUrl(droppedUrls);
  if (failed > 0) console.error(`updateProduct: ${failed} dropped image(s) could not be deleted from R2`);

  revalidateProductPages(product);
  return { ok: true };
}

/**
 * Permanently deletes one of the signed in supplier's own products, in any
 * status (spec 0007, AC-3). Its images go first, and any failure stops
 * before the row is removed (same rule as lib/supplier-deletion.ts): once
 * the row is gone nothing points at a leftover image any more. The delete
 * itself is scoped to the product id the ownership check found.
 */
export async function deleteProduct(productId: string): Promise<ManageProductResult> {
  const { userId } = await auth();
  if (!userId) return NOT_SIGNED_IN;
  if (!z.string().uuid().safeParse(productId).success) return NOT_FOUND;

  let product: OwnedProduct | null;
  try {
    product = await getOwnedProduct(userId, productId);
  } catch {
    return SERVER_ERROR;
  }
  if (!product) return NOT_FOUND;

  const failed = await deleteImagesByUrl(product.imageUrls);
  if (failed > 0) {
    console.error(`deleteProduct: ${failed} image(s) could not be deleted from R2; keeping the product`);
    return { ok: false, code: "server_error", message: "We couldn't remove this product's images. Please try again." };
  }

  const { error } = await supabaseAdmin.from("products").delete().eq("id", product.id);
  if (error) {
    console.error("deleteProduct failed", { code: error.code, message: error.message });
    return SERVER_ERROR;
  }

  revalidateProductPages(product);
  return { ok: true };
}

import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

import { deleteSupplierData } from "@/lib/supplier-deletion";

/**
 * Clerk webhook receiver. Only `user.deleted` is acted on: a supplier who
 * deletes their account has their listing, products and images removed
 * (Privacy Policy, retention). Every request is signature checked with
 * CLERK_WEBHOOK_SIGNING_SECRET before anything else runs.
 */
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Verification failed", { status: 400 });
  }

  if (evt.type === "user.deleted" && evt.data.id) {
    try {
      const result = await deleteSupplierData(evt.data.id);
      console.info("clerk webhook: user.deleted handled", result);
    } catch (error) {
      // A 5xx makes Clerk retry the delivery; the deletion is idempotent.
      console.error("clerk webhook: supplier deletion failed", error);
      return new Response("Deletion failed", { status: 500 });
    }
  }

  return new Response("OK", { status: 200 });
}

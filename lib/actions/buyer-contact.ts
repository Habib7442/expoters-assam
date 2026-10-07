"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getContactAllowance,
  getUnlockedContact,
  type BuyerContact,
  type ContactAllowance,
} from "@/lib/supabase/queries/buyer-contacts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What the Contact Buyer dialog should show (spec 0009). */
export type BuyerContactStatus =
  | { kind: "signed_out" }
  | { kind: "no_company" }
  | { kind: "not_approved" }
  | { kind: "not_found" }
  | { kind: "not_unlockable" }
  | { kind: "unlocked"; contact: BuyerContact; allowance: ContactAllowance | null }
  | { kind: "can_unlock"; allowance: ContactAllowance }
  | { kind: "exhausted"; allowance: ContactAllowance }
  | { kind: "error"; message: string };

export type UnlockBuyerContactResult =
  | {
      ok: true;
      contact: BuyerContact;
      /** null only if the count couldn't be read after a successful unlock. */
      allowance: ContactAllowance | null;
    }
  | {
      ok: false;
      code: "not_signed_in" | "company_not_approved" | "not_found" | "not_unlockable" | "quota_exhausted" | "server_error";
      message: string;
    };

const SERVER_ERROR_MESSAGE = "Something went wrong on our end. Please try again in a moment.";

/**
 * Looks up, without using a contact, whether the signed in supplier can see
 * or unlock this requirement's buyer. Called when the dialog opens, so the
 * public Buy Leads pages stay cached and user independent.
 */
export async function getBuyerContactStatus(buyRequirementId: string): Promise<BuyerContactStatus> {
  const { userId } = await auth();
  if (!userId) return { kind: "signed_out" };
  if (!UUID_RE.test(buyRequirementId)) return { kind: "not_found" };

  try {
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, status")
      .eq("clerk_user_id", userId)
      .maybeSingle();
    if (companyError) throw companyError;
    if (!company) return { kind: "no_company" };
    if (company.status !== "approved") return { kind: "not_approved" };

    const [contact, allowance] = await Promise.all([
      getUnlockedContact(company.id, buyRequirementId),
      getContactAllowance(company.id),
    ]);
    if (contact) return { kind: "unlocked", contact, allowance };

    const { data: requirement, error: requirementError } = await supabaseAdmin
      .from("buy_requirements")
      .select("contact_unlockable")
      .eq("id", buyRequirementId)
      .eq("is_public", true)
      .maybeSingle();
    if (requirementError) throw requirementError;
    if (!requirement) return { kind: "not_found" };
    if (!requirement.contact_unlockable) return { kind: "not_unlockable" };

    return allowance.remaining === 0 ? { kind: "exhausted", allowance } : { kind: "can_unlock", allowance };
  } catch (error) {
    console.error("getBuyerContactStatus failed", error);
    return { kind: "error", message: SERVER_ERROR_MESSAGE };
  }
}

/**
 * Unlocks a buy requirement's buyer for the signed in supplier, using one
 * contact from their plan year unless they unlocked it before. The limit
 * and the race between two unlocks are enforced in `unlock_buy_requirement`,
 * not here.
 */
export async function unlockBuyerContact(buyRequirementId: string): Promise<UnlockBuyerContactResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, code: "not_signed_in", message: "Please sign in first." };
  if (!UUID_RE.test(buyRequirementId)) {
    return { ok: false, code: "not_found", message: "This buy requirement is no longer available." };
  }

  const { data, error } = await supabaseAdmin.rpc("unlock_buy_requirement", {
    p_clerk_user_id: userId,
    p_buy_requirement_id: buyRequirementId,
  });

  if (error) {
    switch (error.code) {
      case "P0007":
        return {
          ok: false,
          code: "company_not_approved",
          message: "Your business needs to be listed and approved before you can contact buyers.",
        };
      case "P0004":
        return { ok: false, code: "not_found", message: "This buy requirement is no longer available." };
      case "P0011":
        return {
          ok: false,
          code: "not_unlockable",
          message: "This buyer's details can't be shared. Use Respond and our team will introduce you.",
        };
      case "P0012":
        return {
          ok: false,
          code: "quota_exhausted",
          message: "You've used all your buyer contacts for this plan year. Upgrade your plan to contact more buyers.",
        };
      default:
        console.error("unlockBuyerContact failed", error);
        return { ok: false, code: "server_error", message: SERVER_ERROR_MESSAGE };
    }
  }

  const row = data?.[0];
  if (!row) {
    console.error("unlockBuyerContact failed: the database returned no row");
    return { ok: false, code: "server_error", message: SERVER_ERROR_MESSAGE };
  }

  if (row.newly_unlocked) revalidatePath("/my-buyer-contacts");

  const contact: BuyerContact = {
    buyRequirementId,
    name: row.contact_name,
    phone: row.phone,
    email: row.email,
    productText: row.product_text,
    quantity: row.quantity,
    location: row.location,
    notes: row.notes,
    postedAt: row.posted_at,
    unlockedAt: new Date().toISOString(),
  };

  // The unlock already succeeded, so a failed count must not hide the
  // contact the supplier just used a credit on.
  let allowance: ContactAllowance | null = null;
  try {
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();
    if (companyError) throw companyError;
    allowance = await getContactAllowance(company.id);
  } catch (allowanceError) {
    console.error("unlockBuyerContact: allowance lookup failed", allowanceError);
  }

  return { ok: true, contact, allowance };
}

import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getContactAllowance, type ContactAllowance } from "@/lib/supabase/queries/buyer-contacts";

export type MyPlan = {
  tier: ContactAllowance["tier"];
  /** When a paid plan ends; null on Basic. */
  expiresAt: string | null;
  contacts: ContactAllowance;
};

/**
 * A company's current plan for the supplier's own pages. Every company is
 * on the free Basic plan unless it has an active, unexpired paid plan (spec
 * 0008), which is the same rule `contact_allowances` uses for the tier.
 * Throws on a database error.
 */
export async function getMyPlan(companyId: string): Promise<MyPlan> {
  const [contacts, membership] = await Promise.all([
    getContactAllowance(companyId),
    supabaseAdmin
      .from("memberships")
      .select("expires_at")
      .eq("company_id", companyId)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (membership.error) throw membership.error;

  return {
    tier: contacts.tier,
    expiresAt: contacts.tier === "basic" ? null : (membership.data?.expires_at ?? null),
    contacts,
  };
}

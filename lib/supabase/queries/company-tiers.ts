import { supabase } from "@/lib/supabase/client";

export type MembershipTier = "basic" | "silver" | "gold";

const DEFAULT_TIER: MembershipTier = "basic";

/** A company's current tier, read through the `company_tiers` view (AC-7), never a stored column. */
export async function getCurrentTier(companyId: string): Promise<MembershipTier> {
  const { data, error } = await supabase
    .from("company_tiers")
    .select("tier")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return (data?.tier as MembershipTier | undefined) ?? DEFAULT_TIER;
}

/** Batch form of {@link getCurrentTier}, one query for a whole listing page. */
export async function getCurrentTiersFor(companyIds: string[]): Promise<Record<string, MembershipTier>> {
  const tiers: Record<string, MembershipTier> = {};
  for (const id of companyIds) tiers[id] = DEFAULT_TIER;
  if (companyIds.length === 0) return tiers;

  const { data, error } = await supabase
    .from("company_tiers")
    .select("company_id, tier")
    .in("company_id", companyIds);

  if (error) throw error;

  for (const row of data ?? []) {
    if (row.company_id) tiers[row.company_id] = (row.tier as MembershipTier | null) ?? DEFAULT_TIER;
  }
  return tiers;
}

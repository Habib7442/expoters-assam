import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type ContactAllowance = {
  tier: "basic" | "silver" | "gold";
  /** null means unlimited (Gold). */
  quota: number | null;
  used: number;
  /** null means unlimited. */
  remaining: number | null;
  periodStart: string;
};

/** A buyer's details as a supplier sees them after unlocking a requirement (spec 0009). */
export type BuyerContact = {
  buyRequirementId: string;
  name: string;
  phone: string;
  email: string | null;
  productText: string;
  quantity: string;
  location: string | null;
  notes: string | null;
  postedAt: string;
  unlockedAt: string;
};

/**
 * A company's buyer contact allowance for its current plan year, from the
 * `contact_allowances` database function (the one place the 1 / 15 /
 * unlimited limits live). Throws on a database error.
 */
export async function getContactAllowance(companyId: string): Promise<ContactAllowance> {
  const { data, error } = await supabaseAdmin.rpc("contact_allowances", { p_company_ids: [companyId] });
  if (error) throw error;

  const row = data?.[0];
  if (!row) throw new Error(`contact_allowances returned no row for company ${companyId}`);

  return {
    tier: row.tier as ContactAllowance["tier"],
    quota: row.quota,
    used: row.used,
    remaining: row.quota === null ? null : Math.max(0, row.quota - row.used),
    periodStart: row.period_start,
  };
}

type UnlockRow = {
  created_at: string;
  buy_requirements: {
    id: string;
    contact_name: string;
    contact_email: string | null;
    product_text: string;
    quantity: string;
    location: string | null;
    notes: string | null;
    created_at: string;
    buyers: { phone: string } | null;
  } | null;
};

const UNLOCK_SELECT =
  "created_at, buy_requirements(id, contact_name, contact_email, product_text, quantity, location, notes, created_at, buyers(phone))";

function toBuyerContact(row: UnlockRow): BuyerContact | null {
  const requirement = row.buy_requirements;
  if (!requirement?.buyers) return null;
  return {
    buyRequirementId: requirement.id,
    name: requirement.contact_name,
    phone: requirement.buyers.phone,
    email: requirement.contact_email,
    productText: requirement.product_text,
    quantity: requirement.quantity,
    location: requirement.location,
    notes: requirement.notes,
    postedAt: requirement.created_at,
    unlockedAt: row.created_at,
  };
}

/** The buyer behind a requirement this company already unlocked, or null if it hasn't. Throws on a database error. */
export async function getUnlockedContact(companyId: string, buyRequirementId: string): Promise<BuyerContact | null> {
  const { data, error } = await supabaseAdmin
    .from("buy_requirement_unlocks")
    .select(UNLOCK_SELECT)
    .eq("company_id", companyId)
    .eq("buy_requirement_id", buyRequirementId)
    .maybeSingle();

  if (error) throw error;
  return data ? toBuyerContact(data) : null;
}

/** Every buyer this company has unlocked, most recent first: the My buyer contacts page. Throws on a database error. */
export async function getMyBuyerContacts(companyId: string): Promise<BuyerContact[]> {
  const { data, error } = await supabaseAdmin
    .from("buy_requirement_unlocks")
    .select(UNLOCK_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toBuyerContact).filter((contact): contact is BuyerContact => contact !== null);
}

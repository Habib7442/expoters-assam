import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Throws unless `clerkUserId` owns `companyId` (companies.clerk_user_id).
 * Call this before any mutating route lets a signed-in supplier touch a
 * company or its products — the only ownership check this project has,
 * since writes go through supabaseAdmin (bypasses RLS), not DB policies.
 */
export async function assertOwnsCompany(clerkUserId: string, companyId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Clerk user ${clerkUserId} does not own company ${companyId}`);
}

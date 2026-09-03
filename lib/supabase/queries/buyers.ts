import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Looks up a buyer by phone (normalized DB-side, AC-9) or creates one.
 * A second submission from the same number reuses the row atomically, even
 * under concurrent inserts (AC-4); a backfilled email never overwrites one
 * already on file. Delegates to the `get_or_create_buyer` DB function since
 * that asymmetric conflict clause can't be expressed via `.upsert()`.
 */
export async function getOrCreateBuyerByPhone(
  phone: string,
  name: string,
  email?: string | null,
): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("get_or_create_buyer", {
    p_phone: phone,
    p_name: name,
    p_email: email ?? undefined,
  });

  if (error) throw error;
  return data.id;
}

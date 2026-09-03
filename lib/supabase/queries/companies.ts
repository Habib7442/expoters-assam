import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type MyCompany = {
  id: string;
  name: string;
  location: string | null;
  logoUrl: string | null;
  about: string | null;
  email: string;
  status: string;
  rejectionReason: string | null;
  whatsappNumber: string | null;
};

/**
 * The signed in Clerk user's own company, whatever its status. Uses
 * `supabaseAdmin` deliberately: a `pending`/`rejected` row is invisible to
 * the public `status = 'approved'` RLS policy, and this is the one read
 * path that must still see it, scoped to the caller's own `clerk_user_id`.
 */
export async function getMyCompany(clerkUserId: string): Promise<MyCompany | null> {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id, name, location, logo_url, about, email, status, rejection_reason, company_contacts(whatsapp_number)")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    location: data.location,
    logoUrl: data.logo_url,
    about: data.about,
    email: data.email,
    status: data.status,
    rejectionReason: data.rejection_reason,
    whatsappNumber: data.company_contacts?.whatsapp_number ?? null,
  };
}

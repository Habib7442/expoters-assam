import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Privileged Supabase client (secret key, bypasses RLS). Server-only —
 * `server-only` throws at build time if this is ever imported from client code.
 * Use for enquiry/buy-requirement writes, WhatsApp-forward bookkeeping, and
 * admin approve/reject actions.
 */
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);

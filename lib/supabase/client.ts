import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Public Supabase client (publishable key, RLS-respecting anon role).
 * Safe to use in both client and server components — Clerk manages auth
 * sessions in this project, not Supabase Auth, so there is no per-request
 * cookie session to bridge here.
 */
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

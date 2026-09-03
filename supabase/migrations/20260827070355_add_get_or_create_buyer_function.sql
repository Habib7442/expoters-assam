-- Implements the exact "on conflict (phone) do update set email = coalesce(...)"
-- pattern from spec 0001's Value sourcing table as one atomic statement, so
-- getOrCreateBuyerByPhone stays safe under concurrent submissions for a
-- brand new phone number (AC-4). supabase-js's .upsert() can't express this
-- asymmetric conflict clause (it overwrites every payload column), hence a
-- DB function called via .rpc() instead.

create or replace function public.get_or_create_buyer(
  p_phone text,
  p_name text,
  p_email text default null
)
returns public.buyers
language sql
set search_path = ''
as $$
  insert into public.buyers (phone, name, email)
  values (p_phone, p_name, p_email)
  on conflict (phone) do update
    set email = coalesce(public.buyers.email, excluded.email)
  returning *;
$$;

-- service_role only: buyers has no RLS policy, and the caller (a server
-- route that already checked whatever it needed) is the only trust boundary
-- here, not this function.
revoke execute on function public.get_or_create_buyer(text, text, text) from public;
grant execute on function public.get_or_create_buyer(text, text, text) to service_role;

-- CodeRabbit (on 20260925010000) correctly flagged: `revoke execute ... from
-- public` does not remove Supabase's *direct* EXECUTE grants to anon and
-- authenticated, which every new function in schema public receives through
-- the project's default privileges. Verified live before this migration:
-- anon and authenticated could EXECUTE every one of the RPCs below, old and
-- new overloads alike. Not an established unauthorized-write path (all are
-- SECURITY INVOKER, and anon/authenticated have no INSERT/UPDATE on the
-- tables they write), but these are meant to be reachable only through the
-- server actions that authenticate and validate first, via service_role.
--
-- Both apps call every one of these through supabaseAdmin (service_role)
-- only, so nothing legitimate loses access. The consent-less overloads are
-- included: they stay only until the new storefront is deployed, and must
-- not be callable by API roles in the meantime.
--
-- Trigger functions (set_updated_at, normalize_*, enquiries_require_reference)
-- and slugify are left alone: trigger functions can't be invoked as RPCs,
-- and slugify is a pure text helper.

revoke execute on function public.create_enquiry(text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_enquiry(text, text, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.create_company_enquiry(text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_company_enquiry(text, text, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.create_buy_requirement(text, text, text, uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.create_buy_requirement(text, text, text, uuid, text, text, text, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.create_business_listing(text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.create_business_listing(text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.update_business_listing(text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.create_product_submission(text, text, text, uuid, text[]) from public, anon, authenticated;
revoke execute on function public.create_category(text, text) from public, anon, authenticated;
revoke execute on function public.update_category(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.get_or_create_buyer(text, text, text) from public, anon, authenticated;

-- Idempotent re-grants, so service_role's access never depends on which
-- earlier migration happened to grant it.
grant execute on function public.create_enquiry(text, text, text, uuid, text) to service_role;
grant execute on function public.create_enquiry(text, text, text, uuid, text, text) to service_role;
grant execute on function public.create_company_enquiry(text, text, text, uuid, text) to service_role;
grant execute on function public.create_company_enquiry(text, text, text, uuid, text, text) to service_role;
grant execute on function public.create_buy_requirement(text, text, text, uuid, text, text, text, text, boolean) to service_role;
grant execute on function public.create_buy_requirement(text, text, text, uuid, text, text, text, text, boolean, text) to service_role;
grant execute on function public.create_business_listing(text, text, text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.create_business_listing(text, text, text, text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.update_business_listing(text, text, text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.create_product_submission(text, text, text, uuid, text[]) to service_role;
grant execute on function public.create_category(text, text) to service_role;
grant execute on function public.update_category(uuid, text, text) to service_role;
grant execute on function public.get_or_create_buyer(text, text, text) to service_role;

-- Close the root cause for future functions too, mirroring what
-- 20260827074706 already did for tables: new functions in public no longer
-- get EXECUTE for the API roles by default. A function that genuinely needs
-- to be a public RPC must now grant it explicitly. service_role's own
-- default grant is untouched.
alter default privileges for role postgres in schema public
revoke execute on functions from public, anon, authenticated;

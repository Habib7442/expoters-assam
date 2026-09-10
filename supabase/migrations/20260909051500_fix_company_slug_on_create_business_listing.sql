-- Fixes a bug in 20260909033000_add_company_slug.sql: that migration
-- redefined create_business_listing with the OLD 6-arg signature (no
-- p_email), predating 20260903130000's amendment to 7 args. Postgres
-- can't CREATE OR REPLACE across a changed parameter list, so it silently
-- created a second, unused 6-arg overload instead of replacing the real
-- one — the live 7-arg function the app actually calls never got slug
-- assignment, so a real supplier signup right now fails on companies.slug's
-- not-null constraint. Caught live, verified by actually calling the RPC.

drop function if exists public.create_business_listing(text, text, text, text, text, text);

create or replace function public.create_business_listing(
  p_clerk_user_id text,
  p_name text,
  p_location text,
  p_logo_url text,
  p_whatsapp_number text,
  p_about text,
  p_email text
)
returns table (company_id uuid, status text)
language plpgsql
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix int := 1;
begin
  v_base_slug := public.slugify(p_name);
  v_slug := v_base_slug;
  while exists (select 1 from public.companies where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.companies (
    clerk_user_id, name, location, logo_url, about, email, country, status, submitted_by, slug
  )
  values (
    p_clerk_user_id, p_name, p_location, p_logo_url, p_about, p_email, 'India', 'pending', 'supplier', v_slug
  )
  returning id into v_company_id;

  insert into public.company_contacts (company_id, whatsapp_number)
  values (v_company_id, p_whatsapp_number);

  return query select v_company_id, 'pending'::text;
end;
$$;

revoke execute on function public.create_business_listing(text, text, text, text, text, text, text) from public;
grant execute on function public.create_business_listing(text, text, text, text, text, text, text) to service_role;

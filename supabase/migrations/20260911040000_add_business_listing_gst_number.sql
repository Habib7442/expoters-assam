-- Adds an optional GST number to the supplier business listing form. Unlike
-- email (spec 0005 amendment), this field is optional, so it's added
-- nullable with no backfill and no not-null step. Not added to the
-- restricted public column grant (20260910020000) for the same reason as
-- email: a business's tax ID has no reason to be readable by the anon/
-- authenticated public role, only by supabaseAdmin on the server.

alter table public.companies add column gst_number text;

-- create_business_listing / update_business_listing: pass gst_number
-- through. The parameter list is changing, so `create or replace` would
-- leave the old 7-arg versions dangling as separate overloads; drop them
-- explicitly first (same reasoning as 20260903130000's email addition).

drop function if exists public.create_business_listing(text, text, text, text, text, text, text);
drop function if exists public.update_business_listing(text, text, text, text, text, text, text);

create or replace function public.create_business_listing(
  p_clerk_user_id text,
  p_name text,
  p_location text,
  p_logo_url text,
  p_whatsapp_number text,
  p_about text,
  p_email text,
  p_gst_number text
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
    clerk_user_id, name, location, logo_url, about, email, gst_number, country, status, submitted_by, slug
  )
  values (
    p_clerk_user_id, p_name, p_location, p_logo_url, p_about, p_email, p_gst_number, 'India', 'pending', 'supplier', v_slug
  )
  returning id into v_company_id;

  insert into public.company_contacts (company_id, whatsapp_number)
  values (v_company_id, p_whatsapp_number);

  return query select v_company_id, 'pending'::text;
end;
$$;

revoke execute on function public.create_business_listing(text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_business_listing(text, text, text, text, text, text, text, text) to service_role;

create or replace function public.update_business_listing(
  p_clerk_user_id text,
  p_name text,
  p_location text,
  p_logo_url text,
  p_whatsapp_number text,
  p_about text,
  p_email text,
  p_gst_number text
)
returns table (company_id uuid, status text)
language plpgsql
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  select * into v_company from public.companies where clerk_user_id = p_clerk_user_id;

  if v_company.id is null then
    raise exception using errcode = 'P0004', message = 'company_not_found';
  end if;

  if v_company.status = 'approved' then
    raise exception using errcode = 'P0005', message = 'not_editable';
  end if;

  if v_company.updated_at > now() - interval '10 seconds' then
    raise exception using errcode = 'P0006', message = 'rate_limited';
  end if;

  update public.companies
  set
    name = p_name,
    location = p_location,
    logo_url = coalesce(p_logo_url, logo_url),
    about = p_about,
    email = p_email,
    gst_number = p_gst_number,
    status = 'pending',
    rejection_reason = null
  where id = v_company.id;

  insert into public.company_contacts (company_id, whatsapp_number)
  values (v_company.id, p_whatsapp_number)
  on conflict on constraint company_contacts_pkey
  do update set whatsapp_number = excluded.whatsapp_number;

  return query select v_company.id, 'pending'::text;
end;
$$;

revoke execute on function public.update_business_listing(text, text, text, text, text, text, text, text) from public;
grant execute on function public.update_business_listing(text, text, text, text, text, text, text, text) to service_role;

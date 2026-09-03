-- Adds a required business email to the supplier listing (spec 0005
-- amendment, decided inline with the engineer: required, alongside the
-- existing WhatsApp number). companies already has one row (the demo
-- company from spec 0003), so this can't be added not-null in one step:
-- add nullable, backfill, then constrain.

alter table public.companies add column email text;

update public.companies set email = 'demo@exportsassam.com' where email is null;

alter table public.companies
add constraint companies_email_check
check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table public.companies alter column email set not null;

-- ============================================================================
-- create_business_listing / update_business_listing: pass the email through.
-- The parameter list is changing, so `create or replace` would leave the old
-- 6-arg versions dangling as separate overloads; drop them explicitly first.
-- ============================================================================

drop function if exists public.create_business_listing(text, text, text, text, text, text);
drop function if exists public.update_business_listing(text, text, text, text, text, text);

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
begin
  insert into public.companies (
    clerk_user_id, name, location, logo_url, about, email, country, status, submitted_by
  )
  values (
    p_clerk_user_id, p_name, p_location, p_logo_url, p_about, p_email, 'India', 'pending', 'supplier'
  )
  returning id into v_company_id;

  insert into public.company_contacts (company_id, whatsapp_number)
  values (v_company_id, p_whatsapp_number);

  return query select v_company_id, 'pending'::text;
end;
$$;

revoke execute on function public.create_business_listing(text, text, text, text, text, text, text) from public;
grant execute on function public.create_business_listing(text, text, text, text, text, text, text) to service_role;

create or replace function public.update_business_listing(
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

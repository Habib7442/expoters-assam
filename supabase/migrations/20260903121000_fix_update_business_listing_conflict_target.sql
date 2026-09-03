-- Fixes a bug caught by live testing: `on conflict (company_id)` was
-- ambiguous against the function's own `company_id` OUT parameter (from
-- `returns table (company_id uuid, ...)`), which PL/pgSQL resolves as a
-- variable before the target table's column. Naming the conflict target by
-- constraint instead of column sidesteps the ambiguity entirely.

create or replace function public.update_business_listing(
  p_clerk_user_id text,
  p_name text,
  p_location text,
  p_logo_url text,
  p_whatsapp_number text,
  p_about text
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

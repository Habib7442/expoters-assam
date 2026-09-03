-- Follow up to 20260903120000: caps update_business_listing attempts per
-- caller (spec 0005's security model). create_enquiry rate limits by
-- counting existing rows in the last hour, which works because every
-- enquiry is a new row; an edit updates the same companies row and leaves
-- no history to count, so a genuinely equivalent counter would need new
-- bookkeeping columns this pass has no other use for. A cooldown against
-- the existing updated_at column throttles automated hammering (bounded to
-- a few hundred attempts/hour at worst) without inventing new schema for a
-- low severity threat (an authenticated user can only ever touch their own
-- row). Revisit with a real counter if abuse is ever observed.

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
  on conflict (company_id) do update set whatsapp_number = excluded.whatsapp_number;

  return query select v_company.id, 'pending'::text;
end;
$$;

-- Product decision (confirmed with the client/engineer): an approved
-- business listing can now be edited too, not just pending/rejected ones.
-- Editing always sends it back to 'pending' for re-review — same behavior
-- update_business_listing already applies to a pending/rejected edit, now
-- also applied to an approved one instead of refusing it outright (P0005).
-- Same signature as the current 8-arg version (20260911040000's GST
-- addition), so `create or replace` is enough — no drop needed.

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

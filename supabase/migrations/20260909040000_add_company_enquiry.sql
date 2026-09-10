-- create_company_enquiry: the same Send Enquiry action proven for products
-- (spec 0003's create_enquiry), extended to a company profile page directly
-- (feature 9). Mirrors create_enquiry's shape exactly (buyer resolution,
-- the same per-buyer advisory lock, the same global 1-hour/5-enquiry rate
-- limit across every enquiry type, a 10-minute dedup window scoped to this
-- company), but validates the target company instead of a product and
-- leaves enquiries.product_id null.

create or replace function public.create_company_enquiry(
  p_phone text,
  p_name text,
  p_email text,
  p_company_id uuid,
  p_message text
)
returns table (enquiry_id uuid, rate_limited boolean, whatsapp_number text)
language plpgsql
set search_path = ''
as $$
declare
  v_buyer public.buyers;
  v_company record;
  v_recent_count int;
  v_existing_id uuid;
  v_new_id uuid;
  v_wa_number text;
begin
  select c.id, c.name into v_company
  from public.companies c
  where c.id = p_company_id and c.status = 'approved';

  if v_company.id is null then
    raise exception using errcode = 'P0002', message = 'company_not_found';
  end if;

  v_buyer := public.get_or_create_buyer(p_phone, p_name, p_email);

  -- Same lock as create_enquiry: serializes concurrent requests from the
  -- same buyer before counting, so two requests racing each other can't
  -- both pass the rate limit.
  perform pg_advisory_xact_lock(hashtext(v_buyer.id::text));

  select cc.whatsapp_number into v_wa_number
  from public.company_contacts cc
  where cc.company_id = v_company.id;

  -- De-duplicate a double submit: same buyer, same company, no product,
  -- last 10 minutes.
  select id into v_existing_id from public.enquiries
  where buyer_id = v_buyer.id and company_id = v_company.id and product_id is null
    and created_at > now() - interval '10 minutes'
  limit 1;

  if v_existing_id is not null then
    return query select v_existing_id, false, v_wa_number;
    return;
  end if;

  -- Same global cap as create_enquiry: every enquiry this buyer has sent in
  -- the last hour, regardless of type, not a separate per-surface counter.
  select count(*) into v_recent_count from public.enquiries
  where buyer_id = v_buyer.id and created_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    return query select null::uuid, true, null::text;
    return;
  end if;

  insert into public.enquiries (
    buyer_id, company_id, company_name,
    contact_name, contact_email, message, whatsapp_forwarded_at
  )
  values (
    v_buyer.id, v_company.id, v_company.name,
    p_name, nullif(btrim(coalesce(p_email, '')), ''), nullif(btrim(coalesce(p_message, '')), ''),
    case when v_wa_number is not null then now() else null end
  )
  returning id into v_new_id;

  return query select v_new_id, false, v_wa_number;
end;
$$;

revoke execute on function public.create_company_enquiry(text, text, text, uuid, text) from public;
grant execute on function public.create_company_enquiry(text, text, text, uuid, text) to service_role;

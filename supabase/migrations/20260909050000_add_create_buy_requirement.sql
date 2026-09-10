-- create_buy_requirement (feature 8): a visitor posts what they want to
-- buy; the moment they submit, they become a buyer (PRD's visitor->buyer
-- distinction), same as create_enquiry. Same buyer-resolution/advisory-lock
-- shape as create_enquiry/create_company_enquiry, with its own rate limit
-- (posting a requirement is a heavier action than sending one enquiry, so a
-- lower cap: 3/hour vs enquiries' 5/hour) and no dedup window, since two
-- distinct requirements from the same buyer in one sitting are legitimate
-- (different products), unlike a resubmitted form.

create or replace function public.create_buy_requirement(
  p_phone text,
  p_name text,
  p_email text,
  p_category_id uuid,
  p_product_text text,
  p_quantity text,
  p_location text,
  p_notes text,
  p_is_public boolean
)
returns table (buy_requirement_id uuid, rate_limited boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_buyer public.buyers;
  v_recent_count int;
  v_new_id uuid;
begin
  v_buyer := public.get_or_create_buyer(p_phone, p_name, p_email);

  perform pg_advisory_xact_lock(hashtext(v_buyer.id::text));

  select count(*) into v_recent_count from public.buy_requirements
  where buyer_id = v_buyer.id and created_at > now() - interval '1 hour';

  if v_recent_count >= 3 then
    return query select null::uuid, true;
    return;
  end if;

  insert into public.buy_requirements (
    buyer_id, category_id, product_text, quantity, location, notes,
    contact_name, contact_email, is_public
  )
  values (
    v_buyer.id, p_category_id, p_product_text, p_quantity,
    nullif(btrim(coalesce(p_location, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''),
    p_name, nullif(btrim(coalesce(p_email, '')), ''), p_is_public
  )
  returning id into v_new_id;

  return query select v_new_id, false;
end;
$$;

revoke execute on function public.create_buy_requirement(text, text, text, uuid, text, text, text, text, boolean) from public;
grant execute on function public.create_buy_requirement(text, text, text, uuid, text, text, text, text, boolean) to service_role;

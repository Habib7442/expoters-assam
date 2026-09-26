-- Feature 9, buy requirement half: a supplier replies to a public buy
-- requirement. Decided 2026-09-26 by the engineer: the reply goes to the
-- platform's own WhatsApp number (the server action builds that link from
-- PLATFORM_WHATSAPP_NUMBER), and the client's team introduces the two sides.
-- The posting buyer's phone is never read or returned here.
--
-- Mirrors create_company_enquiry exactly (consent required, buyer
-- resolution for whoever is replying, the same global 5/hour per sender
-- rate limit, a 10 minute dedup window scoped to this requirement), with
-- two differences: the target must be a PUBLIC requirement (a private one
-- is never shown, so it can't be replied to), and there is no WhatsApp
-- number to return, so whatsapp_forwarded_at stays null (the sender opens
-- the platform wa.me link themselves; nothing is forwarded server side).
--
-- product_name snapshots the requirement's product_text, so an enquiry row
-- stays readable after the 12 month retention job purges the requirement
-- (buy_requirement_id is ON DELETE SET NULL).

create or replace function public.create_buy_requirement_enquiry(
  p_phone text,
  p_name text,
  p_email text,
  p_buy_requirement_id uuid,
  p_message text,
  p_consent_notice_version text
)
returns table (enquiry_id uuid, rate_limited boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_buyer public.buyers;
  v_requirement record;
  v_recent_count int;
  v_existing_id uuid;
  v_new_id uuid;
begin
  if nullif(btrim(coalesce(p_consent_notice_version, '')), '') is null then
    raise exception using errcode = 'P0009', message = 'consent_required';
  end if;

  select br.id, br.product_text into v_requirement
  from public.buy_requirements br
  where br.id = p_buy_requirement_id and br.is_public;

  if v_requirement.id is null then
    raise exception using errcode = 'P0002', message = 'buy_requirement_not_found';
  end if;

  v_buyer := public.get_or_create_buyer(p_phone, p_name, p_email);

  perform pg_advisory_xact_lock(hashtext(v_buyer.id::text));

  select id into v_existing_id from public.enquiries
  where buyer_id = v_buyer.id and buy_requirement_id = v_requirement.id
    and created_at > now() - interval '10 minutes'
  limit 1;

  if v_existing_id is not null then
    return query select v_existing_id, false;
    return;
  end if;

  select count(*) into v_recent_count from public.enquiries
  where buyer_id = v_buyer.id and created_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    return query select null::uuid, true;
    return;
  end if;

  insert into public.enquiries (
    buyer_id, buy_requirement_id, product_name,
    contact_name, contact_email, message,
    consent_notice_version, consent_given_at
  )
  values (
    v_buyer.id, v_requirement.id, v_requirement.product_text,
    p_name, nullif(btrim(coalesce(p_email, '')), ''), nullif(btrim(coalesce(p_message, '')), ''),
    btrim(p_consent_notice_version), now()
  )
  returning id into v_new_id;

  return query select v_new_id, false;
end;
$$;

-- service_role only, like every other create_* RPC: enquiries has no RLS
-- policy, and the only caller is a trusted server action.
revoke execute on function public.create_buy_requirement_enquiry(text, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_buy_requirement_enquiry(text, text, text, uuid, text, text) to service_role;

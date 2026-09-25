-- DPDP Act s. 6(10): the Data Fiduciary must be able to prove that notice
-- was given and consent obtained. The storefront's three collection forms
-- (enquiry, buy requirement, business listing) now require an explicit,
-- unticked consent checkbox; this records, per row, when that consent was
-- given and which version of the Privacy Policy it was given against.
--
-- Both columns nullable: rows created before consent capture existed have
-- neither, and stay null (honestly "no recorded consent") rather than being
-- backfilled with a consent nobody gave. A CHECK keeps the pair consistent.
-- No public grant is needed or added: buy_requirements and companies use
-- column-level anon grants (20260910020000), so new columns are private by
-- default, and enquiries has no anon grant at all.
--
-- Each create_* function gains a trailing, required p_consent_notice_version
-- and rejects a blank one (P0009), so consent can't be skipped by a future
-- caller of the RPC, not just by the server action in front of it today.
--
-- Expand/contract: the new signatures are added as overloads and the old,
-- consent-less ones are deliberately LEFT in place, because the currently
-- deployed storefront still calls them — dropping them here would break
-- enquiries/listings on the live site until the new code ships. Once the
-- storefront calling the new signatures is deployed, a follow-up migration
-- must drop the old four, so no consent-less path survives.

alter table public.enquiries
  add column consent_notice_version text,
  add column consent_given_at timestamptz,
  add constraint enquiries_consent_pair_check
    check ((consent_notice_version is null) = (consent_given_at is null));

alter table public.buy_requirements
  add column consent_notice_version text,
  add column consent_given_at timestamptz,
  add constraint buy_requirements_consent_pair_check
    check ((consent_notice_version is null) = (consent_given_at is null));

alter table public.companies
  add column consent_notice_version text,
  add column consent_given_at timestamptz,
  add constraint companies_consent_pair_check
    check ((consent_notice_version is null) = (consent_given_at is null));

-- A pre-ticked "show publicly" default isn't valid consent under the DPDP
-- Act; the form now defaults it off, and so does the table.
alter table public.buy_requirements alter column is_public set default false;

-- ============================================================================
-- create_enquiry (body unchanged from 20260827080000 apart from consent)
-- ============================================================================

create or replace function public.create_enquiry(
  p_phone text,
  p_name text,
  p_email text,
  p_product_id uuid,
  p_message text,
  p_consent_notice_version text
)
returns table (enquiry_id uuid, rate_limited boolean, whatsapp_number text)
language plpgsql
set search_path = ''
as $$
declare
  v_buyer public.buyers;
  v_product record;
  v_recent_count int;
  v_existing_id uuid;
  v_new_id uuid;
  v_wa_number text;
begin
  if nullif(btrim(coalesce(p_consent_notice_version, '')), '') is null then
    raise exception using errcode = 'P0009', message = 'consent_required';
  end if;

  select p.id, p.name, p.company_id, c.name as company_name
    into v_product
  from public.products p
  join public.companies c on c.id = p.company_id
  where p.id = p_product_id and p.status = 'approved' and c.status = 'approved';

  if v_product.id is null then
    raise exception using errcode = 'P0002', message = 'product_not_found';
  end if;

  v_buyer := public.get_or_create_buyer(p_phone, p_name, p_email);

  perform pg_advisory_xact_lock(hashtext(v_buyer.id::text));

  select cc.whatsapp_number into v_wa_number
  from public.company_contacts cc
  where cc.company_id = v_product.company_id;

  select id into v_existing_id from public.enquiries
  where buyer_id = v_buyer.id and product_id = v_product.id
    and created_at > now() - interval '10 minutes'
  limit 1;

  if v_existing_id is not null then
    return query select v_existing_id, false, v_wa_number;
    return;
  end if;

  select count(*) into v_recent_count from public.enquiries
  where buyer_id = v_buyer.id and created_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    return query select null::uuid, true, null::text;
    return;
  end if;

  insert into public.enquiries (
    buyer_id, product_id, company_id, product_name, company_name,
    contact_name, contact_email, message, whatsapp_forwarded_at,
    consent_notice_version, consent_given_at
  )
  values (
    v_buyer.id, v_product.id, v_product.company_id, v_product.name, v_product.company_name,
    p_name, nullif(btrim(coalesce(p_email, '')), ''), nullif(btrim(coalesce(p_message, '')), ''),
    case when v_wa_number is not null then now() else null end,
    btrim(p_consent_notice_version), now()
  )
  returning id into v_new_id;

  return query select v_new_id, false, v_wa_number;
end;
$$;

revoke execute on function public.create_enquiry(text, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_enquiry(text, text, text, uuid, text, text) to service_role;

-- ============================================================================
-- create_company_enquiry (body unchanged from 20260909040000 apart from consent)
-- ============================================================================

create or replace function public.create_company_enquiry(
  p_phone text,
  p_name text,
  p_email text,
  p_company_id uuid,
  p_message text,
  p_consent_notice_version text
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
  if nullif(btrim(coalesce(p_consent_notice_version, '')), '') is null then
    raise exception using errcode = 'P0009', message = 'consent_required';
  end if;

  select c.id, c.name into v_company
  from public.companies c
  where c.id = p_company_id and c.status = 'approved';

  if v_company.id is null then
    raise exception using errcode = 'P0002', message = 'company_not_found';
  end if;

  v_buyer := public.get_or_create_buyer(p_phone, p_name, p_email);

  perform pg_advisory_xact_lock(hashtext(v_buyer.id::text));

  select cc.whatsapp_number into v_wa_number
  from public.company_contacts cc
  where cc.company_id = v_company.id;

  select id into v_existing_id from public.enquiries
  where buyer_id = v_buyer.id and company_id = v_company.id and product_id is null
    and created_at > now() - interval '10 minutes'
  limit 1;

  if v_existing_id is not null then
    return query select v_existing_id, false, v_wa_number;
    return;
  end if;

  select count(*) into v_recent_count from public.enquiries
  where buyer_id = v_buyer.id and created_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    return query select null::uuid, true, null::text;
    return;
  end if;

  insert into public.enquiries (
    buyer_id, company_id, company_name,
    contact_name, contact_email, message, whatsapp_forwarded_at,
    consent_notice_version, consent_given_at
  )
  values (
    v_buyer.id, v_company.id, v_company.name,
    p_name, nullif(btrim(coalesce(p_email, '')), ''), nullif(btrim(coalesce(p_message, '')), ''),
    case when v_wa_number is not null then now() else null end,
    btrim(p_consent_notice_version), now()
  )
  returning id into v_new_id;

  return query select v_new_id, false, v_wa_number;
end;
$$;

revoke execute on function public.create_company_enquiry(text, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_company_enquiry(text, text, text, uuid, text, text) to service_role;

-- ============================================================================
-- create_buy_requirement (body unchanged from 20260909050000 apart from consent)
-- ============================================================================

create or replace function public.create_buy_requirement(
  p_phone text,
  p_name text,
  p_email text,
  p_category_id uuid,
  p_product_text text,
  p_quantity text,
  p_location text,
  p_notes text,
  p_is_public boolean,
  p_consent_notice_version text
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
  if nullif(btrim(coalesce(p_consent_notice_version, '')), '') is null then
    raise exception using errcode = 'P0009', message = 'consent_required';
  end if;

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
    contact_name, contact_email, is_public,
    consent_notice_version, consent_given_at
  )
  values (
    v_buyer.id, p_category_id, p_product_text, p_quantity,
    nullif(btrim(coalesce(p_location, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''),
    p_name, nullif(btrim(coalesce(p_email, '')), ''), p_is_public,
    btrim(p_consent_notice_version), now()
  )
  returning id into v_new_id;

  return query select v_new_id, false;
end;
$$;

revoke execute on function public.create_buy_requirement(text, text, text, uuid, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.create_buy_requirement(text, text, text, uuid, text, text, text, text, boolean, text) to service_role;

-- ============================================================================
-- create_business_listing (body unchanged from 20260911070000 apart from consent)
-- ============================================================================

create or replace function public.create_business_listing(
  p_clerk_user_id text,
  p_name text,
  p_location text,
  p_logo_url text,
  p_whatsapp_number text,
  p_about text,
  p_email text,
  p_gst_number text,
  p_state text,
  p_country text,
  p_address_line text,
  p_postal_code text,
  p_consent_notice_version text
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
  if nullif(btrim(coalesce(p_consent_notice_version, '')), '') is null then
    raise exception using errcode = 'P0009', message = 'consent_required';
  end if;

  v_base_slug := public.slugify(p_name);
  v_slug := v_base_slug;
  while exists (select 1 from public.companies where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.companies (
    clerk_user_id, name, location, logo_url, about, email, gst_number, state, country,
    address_line, postal_code, status, submitted_by, slug,
    consent_notice_version, consent_given_at
  )
  values (
    p_clerk_user_id, p_name, p_location, p_logo_url, p_about, p_email, p_gst_number, p_state, p_country,
    p_address_line, p_postal_code, 'pending', 'supplier', v_slug,
    btrim(p_consent_notice_version), now()
  )
  returning id into v_company_id;

  insert into public.company_contacts (company_id, whatsapp_number)
  values (v_company_id, p_whatsapp_number);

  return query select v_company_id, 'pending'::text;
end;
$$;

revoke execute on function public.create_business_listing(text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_business_listing(text, text, text, text, text, text, text, text, text, text, text, text, text) to service_role;

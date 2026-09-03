-- Adds what spec 0001 deliberately left open for the first feature that
-- needed them: a place to store a supplier's WhatsApp number, and a clean
-- URL slug for a product.
-- Spec: docs/specs/0003-product-page-send-enquiry/index.md

-- ============================================================================
-- company_contacts
-- ============================================================================

-- One row per company that has provided a WhatsApp number; absence of a row
-- means "no number on file." A separate table, not a column on companies,
-- because RLS with no policy at all (like buyers/enquiries/memberships) is
-- structurally unreadable under every query shape, where a column-level
-- REVOKE would have been a silent no-op against companies' existing
-- table-level `grant select ... to anon, authenticated` (proven empirically
-- against the linked project before this migration).
create table public.company_contacts (
  company_id uuid primary key references public.companies (id) on delete cascade,
  whatsapp_number text not null check (whatsapp_number ~ '^\+[1-9][0-9]{9,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger company_contacts_set_updated_at
before update on public.company_contacts
for each row execute function public.set_updated_at();

-- Same normalization rule as buyers.phone (spec 0001), a second trigger
-- rather than a shared function so as not to touch that migration.
create or replace function public.normalize_company_whatsapp_number()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  digits text;
begin
  digits := regexp_replace(new.whatsapp_number, '[^0-9]', '', 'g');

  if left(digits, 2) = '00' then
    digits := substring(digits from 3);
  elsif left(digits, 1) = '0' and length(digits) = 11 then
    digits := substring(digits from 2);
  end if;

  if length(digits) = 10 then
    new.whatsapp_number := '+91' || digits;
  else
    new.whatsapp_number := '+' || digits;
  end if;
  return new;
end;
$$;

create trigger company_contacts_normalize_whatsapp_number
before insert or update on public.company_contacts
for each row execute function public.normalize_company_whatsapp_number();

alter table public.company_contacts enable row level security;
-- No policy at all, same as buyers/enquiries/memberships: only
-- supabaseAdmin (service role) ever touches this table.

-- Belt-and-braces alongside RLS: the default-privilege revoke added in
-- 20260827074706 only covers insert/update/delete for future tables, not
-- select, so this table still needs its own explicit select revoke.
revoke select on public.company_contacts from anon, authenticated;

-- ============================================================================
-- products.slug
-- ============================================================================

-- Safe to add not null directly: products has zero rows at this point in
-- the project's history. A future migration adding a not-null column to a
-- populated table would need a nullable-then-backfill-then-not-null path.
alter table public.products add column slug text not null unique;

create index products_slug_idx on public.products (slug);

-- ============================================================================
-- create_enquiry: atomically resolves/creates the buyer, rate-limits,
-- de-duplicates, inserts the enquiry, and returns the company's WhatsApp
-- number (if any) so the caller can build a wa.me link in the same round
-- trip. No two concurrent requests from the same buyer can race each other.
-- ============================================================================

create or replace function public.create_enquiry(
  p_phone text,
  p_name text,
  p_email text,
  p_product_id uuid,
  p_message text
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
  -- Only an approved product whose company is also approved (AC-8);
  -- supabaseAdmin bypasses RLS, so this check has to live here, not the
  -- application layer.
  select p.id, p.name, p.company_id, c.name as company_name
    into v_product
  from public.products p
  join public.companies c on c.id = p.company_id
  where p.id = p_product_id and p.status = 'approved' and c.status = 'approved';

  if v_product.id is null then
    raise exception using errcode = 'P0002', message = 'product_not_found';
  end if;

  v_buyer := public.get_or_create_buyer(p_phone, p_name, p_email);

  -- Serialize concurrent requests from the same buyer before counting, so
  -- two requests racing each other can't both pass the rate limit.
  perform pg_advisory_xact_lock(hashtext(v_buyer.id::text));

  select cc.whatsapp_number into v_wa_number
  from public.company_contacts cc
  where cc.company_id = v_product.company_id;

  -- De-duplicate a double submit: same buyer, same product, last 10 minutes.
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
    contact_name, contact_email, message, whatsapp_forwarded_at
  )
  values (
    v_buyer.id, v_product.id, v_product.company_id, v_product.name, v_product.company_name,
    p_name, nullif(btrim(coalesce(p_email, '')), ''), nullif(btrim(coalesce(p_message, '')), ''),
    case when v_wa_number is not null then now() else null end
  )
  returning id into v_new_id;

  return query select v_new_id, false, v_wa_number;
end;
$$;

-- service_role only: enquiries has no RLS policy, and the caller (a server
-- action that already validated input) is the only trust boundary here.
revoke execute on function public.create_enquiry(text, text, text, uuid, text) from public;
grant execute on function public.create_enquiry(text, text, text, uuid, text) to service_role;

-- Hottest query in create_enquiry (the rate limit / dedup checks above).
create index enquiries_buyer_id_created_at_idx on public.enquiries (buyer_id, created_at desc);

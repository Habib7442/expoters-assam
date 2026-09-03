-- Supplier business listing (spec 0005): a supplier's Clerk account becomes
-- a real, pending companies row through one atomic write. Two schema
-- changes plus two functions mirroring create_enquiry/get_or_create_buyer's
-- atomic pattern.
-- Spec: docs/specs/0005-supplier-business-listing/index.md

-- ============================================================================
-- companies.status: widen to allow 'rejected' (it did not before this
-- migration; verified against the live constraint, not assumed).
-- ============================================================================

alter table public.companies drop constraint companies_status_check;

alter table public.companies
add constraint companies_status_check check (status in ('pending', 'approved', 'rejected'));

-- ============================================================================
-- companies.rejection_reason: mirrors products.rejection_reason exactly,
-- same multi column check tying it to status = 'rejected'.
-- ============================================================================

alter table public.companies add column rejection_reason text;

alter table public.companies
add constraint companies_rejection_reason_check
check (status = 'rejected' or rejection_reason is null);

-- ============================================================================
-- create_business_listing: inserts the companies row and its
-- company_contacts row in one transaction. A PL/pgSQL function body runs in
-- the caller's transaction, so an exception from either insert (a unique
-- violation on clerk_user_id, or the whatsapp_number check) rolls back both;
-- no separate advisory lock is needed the way create_enquiry needs one for
-- its count based rate limit, since the unique constraint itself is the
-- atomic guard here.
-- ============================================================================

create or replace function public.create_business_listing(
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
  v_company_id uuid;
begin
  insert into public.companies (
    clerk_user_id, name, location, logo_url, about, country, status, submitted_by
  )
  values (
    p_clerk_user_id, p_name, p_location, p_logo_url, p_about, 'India', 'pending', 'supplier'
  )
  returning id into v_company_id;

  insert into public.company_contacts (company_id, whatsapp_number)
  values (v_company_id, p_whatsapp_number);

  return query select v_company_id, 'pending'::text;
end;
$$;

revoke execute on function public.create_business_listing(text, text, text, text, text, text) from public;
grant execute on function public.create_business_listing(text, text, text, text, text, text) to service_role;

-- ============================================================================
-- update_business_listing: edits the caller's own row, scoped by
-- clerk_user_id (the one-company-per-user constraint makes this the entire
-- ownership check, no separate lookup-then-act step to race against).
-- Refuses an approved row (AC-6) at this layer, not only in the UI.
-- Always sets status back to 'pending' and clears rejection_reason, since
-- the only callers of this function are a pending edit (a no-op status
-- change) or a rejected resubmit (the AC-5 transition).
-- ============================================================================

create or replace function public.update_business_listing(
  p_clerk_user_id text,
  p_name text,
  p_location text,
  p_logo_url text, -- null means "keep the existing logo"
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

revoke execute on function public.update_business_listing(text, text, text, text, text, text) from public;
grant execute on function public.update_business_listing(text, text, text, text, text, text) to service_role;

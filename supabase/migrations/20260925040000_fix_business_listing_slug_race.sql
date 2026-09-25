-- CodeRabbit correctly flagged the same check-then-insert race in
-- create_business_listing that 20260911080000 already fixed for
-- create_product_submission: `while exists (select ...)` and the insert are
-- separate operations, so two concurrent signups with the same business name
-- can both see a slug as free, and the loser raises unique_violation on
-- companies_slug_key. The server action then mapped every 23505 to
-- "You already have a business listed", which is wrong for a slug collision
-- and unrecoverable for the caller.
--
-- Unlike products, companies has TWO unique constraints besides its primary
-- key: slug, and clerk_user_id (one company per supplier). So the retry is
-- scoped to companies_slug_key only; a duplicate clerk_user_id is re-raised
-- unchanged and stays a hard "already listed" error. The probe loop is kept
-- as the fast path (it avoids an exception per taken slug in the common,
-- non-concurrent case); the exception handler covers the race it can't.
-- Bounded at 50 retries so a pathological case fails instead of spinning.
--
-- Replaces the consent-recording overload from 20260925010000 in place (same
-- signature). The old consent-less overload keeps the race until it is
-- dropped after the new storefront deploys; it is no longer callable by API
-- roles (20260925030000) and the deployed storefront is its only caller.

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
  v_constraint text;
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

  loop
    begin
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

      exit;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint is distinct from 'companies_slug_key' or v_suffix >= 50 then
          raise;
        end if;
        v_suffix := v_suffix + 1;
        v_slug := v_base_slug || '-' || v_suffix;
    end;
  end loop;

  insert into public.company_contacts (company_id, whatsapp_number)
  values (v_company_id, p_whatsapp_number);

  return query select v_company_id, 'pending'::text;
end;
$$;

-- create or replace keeps existing grants; restated so this file alone is
-- correct on a fresh database.
revoke execute on function public.create_business_listing(text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_business_listing(text, text, text, text, text, text, text, text, text, text, text, text, text) to service_role;

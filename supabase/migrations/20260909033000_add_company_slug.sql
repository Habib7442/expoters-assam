-- Adds a URL slug to companies for the company profile page (feature 5),
-- mirroring products.slug (spec 0003). Unlike products when its slug was
-- added, companies already has rows, so this is nullable-then-backfill-
-- then-not-null rather than a direct not-null add.

alter table public.companies add column slug text;

-- Same slugify rule as generateSlug() (lib/supabase/queries/products.ts):
-- lowercase, collapse non-alphanumeric runs to a single hyphen, trim. Ties
-- between companies slugifying to the same value keep the first (by id)
-- and suffix the rest with a short id fragment, so the backfill can never
-- collide.
with slugged as (
  select
    id,
    coalesce(nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''), 'company') as base_slug
  from public.companies
),
deduped as (
  select
    id,
    case
      when row_number() over (partition by base_slug order by id) = 1
        then base_slug
      else base_slug || '-' || substring(id::text, 1, 8)
    end as slug
  from slugged
)
update public.companies c
set slug = d.slug
from deduped d
where c.id = d.id;

alter table public.companies alter column slug set not null;
alter table public.companies add constraint companies_slug_key unique (slug);
create index companies_slug_idx on public.companies (slug);

-- Reused by create_business_listing below; a plain SQL function (not
-- PL/pgSQL) since it is a single expression with no control flow.
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(p_text), '[^a-z0-9]+', '-', 'g')), ''), 'company');
$$;

-- create_business_listing now also assigns a slug at insert time: the base
-- slugified name, or that name suffixed with an incrementing counter if a
-- company with that slug already exists. The slug is never regenerated on
-- update_business_listing (a rename should not break an existing URL).
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
  v_base_slug text;
  v_slug text;
  v_suffix int := 1;
begin
  v_base_slug := public.slugify(p_name);
  v_slug := v_base_slug;
  while exists (select 1 from public.companies where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.companies (
    clerk_user_id, name, location, logo_url, about, country, status, submitted_by, slug
  )
  values (
    p_clerk_user_id, p_name, p_location, p_logo_url, p_about, 'India', 'pending', 'supplier', v_slug
  )
  returning id into v_company_id;

  insert into public.company_contacts (company_id, whatsapp_number)
  values (v_company_id, p_whatsapp_number);

  return query select v_company_id, 'pending'::text;
end;
$$;

revoke execute on function public.create_business_listing(text, text, text, text, text, text) from public;
grant execute on function public.create_business_listing(text, text, text, text, text, text) to service_role;

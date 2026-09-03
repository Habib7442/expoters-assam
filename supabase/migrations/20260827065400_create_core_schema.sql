-- Core schema: companies, products, categories, buyers, buy_requirements,
-- enquiries, memberships, plus company_tiers / directory_stats views.
-- Spec: docs/specs/0001-database-schema-access-model/index.md

-- ============================================================================
-- Shared trigger functions
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- categories
-- ============================================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- companies
-- ============================================================================

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  name text not null check (length(btrim(name)) > 0),
  logo_url text,
  about text,
  location text,
  country text not null default 'India',
  verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  submitted_by text not null check (submitted_by in ('supplier', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_status_idx on public.companies (status);

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- ============================================================================
-- products
-- ============================================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  description text,
  image_url text not null check (length(btrim(image_url)) > 0),
  gallery_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by text not null check (submitted_by in ('supplier', 'admin')),
  rejection_reason text check (status = 'rejected' or rejection_reason is null),
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_company_id_idx on public.products (company_id);
create index products_category_id_idx on public.products (category_id);
create index products_status_idx on public.products (status);

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- ============================================================================
-- buyers
-- ============================================================================

create table public.buyers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{9,14}$'),
  phone_raw text,
  email text,
  created_at timestamptz not null default now()
);

-- Normalizes buyers.phone to "+<digits>" before the unique constraint and the
-- format check apply (AC-9). Deliberately simple, India-centric: a bare
-- 10-digit number is assumed to be +91; anything else just gets a "+" and its
-- digits stripped of everything else. See spec Follow-up for international.
create or replace function public.normalize_buyer_phone()
returns trigger
language plpgsql
as $$
declare
  digits text;
begin
  new.phone_raw := coalesce(new.phone_raw, new.phone);
  digits := regexp_replace(new.phone, '[^0-9]', '', 'g');
  if length(digits) = 10 then
    new.phone := '+91' || digits;
  else
    new.phone := '+' || digits;
  end if;
  return new;
end;
$$;

create trigger buyers_normalize_phone
before insert or update on public.buyers
for each row execute function public.normalize_buyer_phone();

-- ============================================================================
-- buy_requirements
-- ============================================================================

create table public.buy_requirements (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  product_text text not null,
  quantity text not null,
  location text,
  notes text,
  contact_name text not null,
  contact_email text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index buy_requirements_buyer_id_idx on public.buy_requirements (buyer_id);
create index buy_requirements_category_id_idx on public.buy_requirements (category_id);
create index buy_requirements_is_public_idx on public.buy_requirements (is_public);

-- ============================================================================
-- enquiries
-- ============================================================================

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers (id) on delete restrict,
  product_id uuid references public.products (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  buy_requirement_id uuid references public.buy_requirements (id) on delete set null,
  product_name text,
  company_name text,
  contact_name text not null,
  contact_email text,
  message text,
  whatsapp_forwarded_at timestamptz,
  whatsapp_attempts integer not null default 0,
  whatsapp_last_error text,
  created_at timestamptz not null default now()
);

create index enquiries_buyer_id_idx on public.enquiries (buyer_id);
create index enquiries_product_id_idx on public.enquiries (product_id);
create index enquiries_company_id_idx on public.enquiries (company_id);
create index enquiries_buy_requirement_id_idx on public.enquiries (buy_requirement_id);

-- Requires at least one of product_id / company_id / buy_requirement_id AT
-- INSERT time only (a BEFORE INSERT trigger, not a table CHECK). A CHECK
-- would re-validate on the later ON DELETE SET NULL cascades from
-- products/companies too, and reject the very deletes AC-5 requires to
-- succeed; the snapshot columns keep a fully-nulled row meaningful anyway.
create or replace function public.enquiries_require_reference()
returns trigger
language plpgsql
as $$
begin
  if new.product_id is null and new.company_id is null and new.buy_requirement_id is null then
    raise exception 'enquiries must reference at least one of product_id, company_id, or buy_requirement_id';
  end if;
  return new;
end;
$$;

create trigger enquiries_require_reference_trg
before insert on public.enquiries
for each row execute function public.enquiries_require_reference();

-- ============================================================================
-- memberships
-- ============================================================================

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  tier text not null check (tier in ('silver', 'gold')),
  razorpay_payment_id text unique,
  razorpay_order_id text,
  status text not null check (status in ('active', 'expired', 'cancelled')),
  source text not null check (source in ('self-serve', 'admin-manual')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index memberships_company_id_idx on public.memberships (company_id);

-- A company can never have two active memberships at once (AC-6).
create unique index memberships_one_active_per_company
on public.memberships (company_id)
where status = 'active';

-- ============================================================================
-- Public views (the only way anon/authenticated reach derived facts about
-- otherwise locked-down tables). Deliberately NOT security_invoker: the
-- point is to expose one narrow, safe derived fact from tables anon cannot
-- read directly.
-- ============================================================================

create view public.company_tiers as
select
  c.id as company_id,
  coalesce(
    (select m.tier from public.memberships m
     where m.company_id = c.id and m.status = 'active'
     order by m.starts_at desc limit 1),
    'basic'
  ) as tier
from public.companies c
where c.status = 'approved';

create view public.directory_stats as
select
  (select count(*) from public.companies where status = 'approved' and verified = true) as verified_exporters,
  (select count(*) from public.products where status = 'approved') as products,
  (select count(distinct buyer_id) from public.enquiries) as buyers,
  (select count(distinct country) from public.companies where status = 'approved') as countries;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.categories enable row level security;
alter table public.companies enable row level security;
alter table public.products enable row level security;
alter table public.buyers enable row level security;
alter table public.buy_requirements enable row level security;
alter table public.enquiries enable row level security;
alter table public.memberships enable row level security;

-- Public read surface: categories (all rows), companies/products (approved
-- only), buy_requirements (is_public only). buyers/enquiries/memberships get
-- no policy at all: every write and read on them goes through supabaseAdmin
-- (service role, bypasses RLS) from a server route that has already checked
-- the Clerk session.

create policy categories_public_select
on public.categories
for select
to anon, authenticated
using (true);

create policy companies_public_select
on public.companies
for select
to anon, authenticated
using (status = 'approved');

create policy products_public_select
on public.products
for select
to anon, authenticated
using (status = 'approved');

create policy buy_requirements_public_select
on public.buy_requirements
for select
to anon, authenticated
using (is_public = true);

-- Explicit revoke so a future table added without remembering RLS does not
-- silently become a public write credential.
revoke insert, update, delete on all tables in schema public from anon, authenticated;

grant select on public.categories to anon, authenticated;
grant select on public.companies to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.buy_requirements to anon, authenticated;
grant select on public.company_tiers to anon, authenticated;
grant select on public.directory_stats to anon, authenticated;

-- ============================================================================
-- Storage buckets: product-images, company-logos. Public read, no anon
-- write policy; uploads go through server routes using supabaseAdmin.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

create policy product_images_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy company_logos_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'company-logos');

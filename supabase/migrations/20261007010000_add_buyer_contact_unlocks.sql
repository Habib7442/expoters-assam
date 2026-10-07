-- Buyer contact unlocks (spec 0009), IndiaMART style: a supplier unlocks a
-- public buy requirement and sees the buyer's name, phone and email. One
-- unlock uses one contact from the company's yearly allowance: Basic 1,
-- Silver 15, Gold unlimited. Unlocking the same requirement again is free.
-- The site counts unlocks, not calls (a call happens off platform).

-- ============================================================================
-- Which requirements may be unlocked
-- ============================================================================

-- Only requirements posted publicly under Privacy Policy version 2026-10-07
-- or later, whose notice tells the buyer that suppliers can unlock their
-- contact details. Earlier posts were made under a notice promising the
-- details would never be handed to a supplier, so they stay on the
-- "Respond, our team introduces you" flow. ISO date versions compare
-- correctly as text. Generated, so it follows is_public when an admin
-- hides a requirement.
alter table public.buy_requirements
  add column contact_unlockable boolean
  generated always as (
    is_public and coalesce(consent_notice_version >= '2026-10-07', false)
  ) stored;

-- The storefront's public pages need the flag to pick the right button.
-- It reveals nothing personal.
grant select (contact_unlockable) on public.buy_requirements to anon, authenticated;

-- ============================================================================
-- buy_requirement_unlocks
-- ============================================================================

create table public.buy_requirement_unlocks (
  id uuid primary key default gen_random_uuid(),
  buy_requirement_id uuid not null references public.buy_requirements (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One unlock per company per requirement: a repeat view is free.
  constraint buy_requirement_unlocks_once unique (company_id, buy_requirement_id)
);

-- The allowance counts a company's unlocks since a date.
create index buy_requirement_unlocks_company_created_idx
on public.buy_requirement_unlocks (company_id, created_at);

create index buy_requirement_unlocks_requirement_idx
on public.buy_requirement_unlocks (buy_requirement_id);

-- No policy: read and written only through supabaseAdmin from server code
-- that has already checked the Clerk session.
alter table public.buy_requirement_unlocks enable row level security;

-- ============================================================================
-- contact_allowances: the one place the yearly limits live
-- ============================================================================

-- Per company: its current tier, its yearly quota (null = unlimited), how
-- many it has used, and when the current year started. A paid plan's year
-- starts on the plan's starts_at; on Basic it is the last 12 months. An
-- expired plan counts as Basic, matching company_tiers.
create function public.contact_allowances(p_company_ids uuid[])
returns table (company_id uuid, tier text, quota int, used int, period_start timestamptz)
language sql
stable
set search_path = ''
as $$
  with plan as (
    select
      c.id as company_id,
      m.tier,
      m.starts_at
    from unnest(p_company_ids) as c(id)
    left join lateral (
      select mm.tier, mm.starts_at
      from public.memberships mm
      where mm.company_id = c.id
        and mm.status = 'active'
        and (mm.expires_at is null or mm.expires_at > now())
      order by mm.starts_at desc
      limit 1
    ) m on true
  ),
  shaped as (
    select
      p.company_id,
      coalesce(p.tier, 'basic') as tier,
      case coalesce(p.tier, 'basic') when 'basic' then 1 when 'silver' then 15 else null end as quota,
      coalesce(p.starts_at, now() - interval '1 year') as period_start
    from plan p
  )
  select
    s.company_id,
    s.tier,
    s.quota,
    (select count(*)::int from public.buy_requirement_unlocks u
     where u.company_id = s.company_id and u.created_at >= s.period_start) as used,
    s.period_start
  from shaped s;
$$;

revoke execute on function public.contact_allowances(uuid[]) from public, anon, authenticated;
grant execute on function public.contact_allowances(uuid[]) to service_role;

-- ============================================================================
-- unlock_buy_requirement
-- ============================================================================

-- Unlocks one requirement for the caller's approved company and returns the
-- buyer's contact details. Errors:
--   P0007 company_not_approved  no approved company for this Clerk user
--   P0004 not_found             no such public requirement
--   P0011 not_unlockable        posted before buyers agreed to share contacts
--   P0012 quota_exhausted       no contacts left this year
-- The company row is locked so two unlocks at once can't both take the
-- last contact.
create function public.unlock_buy_requirement(p_clerk_user_id text, p_buy_requirement_id uuid)
returns table (
  contact_name text,
  phone text,
  email text,
  product_text text,
  quantity text,
  location text,
  notes text,
  posted_at timestamptz,
  newly_unlocked boolean
)
language plpgsql
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_unlockable boolean;
  v_quota int;
  v_used int;
  v_new boolean := false;
begin
  select c.id into v_company_id
  from public.companies c
  where c.clerk_user_id = p_clerk_user_id and c.status = 'approved'
  for update;

  if v_company_id is null then
    raise exception using errcode = 'P0007', message = 'company_not_approved';
  end if;

  select r.contact_unlockable into v_unlockable
  from public.buy_requirements r
  where r.id = p_buy_requirement_id and r.is_public;

  if v_unlockable is null then
    raise exception using errcode = 'P0004', message = 'not_found';
  end if;

  if not exists (
    select 1 from public.buy_requirement_unlocks u
    where u.company_id = v_company_id and u.buy_requirement_id = p_buy_requirement_id
  ) then
    if not v_unlockable then
      raise exception using errcode = 'P0011', message = 'not_unlockable';
    end if;

    select a.quota, a.used into v_quota, v_used
    from public.contact_allowances(array[v_company_id]) a;

    if v_quota is not null and v_used >= v_quota then
      raise exception using errcode = 'P0012', message = 'quota_exhausted';
    end if;

    insert into public.buy_requirement_unlocks (buy_requirement_id, company_id)
    values (p_buy_requirement_id, v_company_id);
    v_new := true;
  end if;

  return query
  select r.contact_name, b.phone, r.contact_email, r.product_text, r.quantity,
         r.location, r.notes, r.created_at, v_new
  from public.buy_requirements r
  join public.buyers b on b.id = r.buyer_id
  where r.id = p_buy_requirement_id;
end;
$$;

revoke execute on function public.unlock_buy_requirement(text, uuid) from public, anon, authenticated;
grant execute on function public.unlock_buy_requirement(text, uuid) to service_role;

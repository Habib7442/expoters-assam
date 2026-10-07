-- Membership, revised the same day (spec 0008): no request saved on the
-- storefront. The plan buttons are plain WhatsApp links; the supplier pays
-- and sends the screenshot there, and an admin sets the company's plan
-- directly from the admin app's Memberships page.

drop function public.approve_membership_request(uuid);

-- Sets a company's plan in one transaction. Locks the company row so two
-- admins acting at once run one after the other. Ends any open request
-- and the current plan, then (for silver/gold) starts a one year plan.
-- 'basic' just ends the paid plan.
create function public.set_company_plan(p_company_id uuid, p_tier text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_tier not in ('basic', 'silver', 'gold') then
    raise exception using errcode = 'P0002', message = 'invalid_tier';
  end if;

  perform 1 from public.companies c where c.id = p_company_id for update;
  if not found then
    raise exception using errcode = 'P0004', message = 'company_not_found';
  end if;

  update public.memberships
  set status = 'cancelled', reviewed_at = now()
  where company_id = p_company_id and status in ('active', 'pending');

  if p_tier <> 'basic' then
    insert into public.memberships (company_id, tier, status, source, starts_at, expires_at, reviewed_at)
    values (p_company_id, p_tier, 'active', 'admin-manual', now(), now() + interval '1 year', now());
  end if;
end;
$$;

revoke execute on function public.set_company_plan(uuid, text) from public, anon, authenticated;
grant execute on function public.set_company_plan(uuid, text) to service_role;

-- Plans are yearly now: a plan past its expires_at drops back to basic on
-- the public site without anyone having to cancel it. Same columns as
-- before, so `create or replace` keeps the view's existing grants.
create or replace view public.company_tiers as
select
  c.id as company_id,
  coalesce(
    (select m.tier from public.memberships m
     where m.company_id = c.id
       and m.status = 'active'
       and (m.expires_at is null or m.expires_at > now())
     order by m.starts_at desc limit 1),
    'basic'
  ) as tier
from public.companies c
where c.status = 'approved';

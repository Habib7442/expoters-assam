-- Manual membership requests (spec 0008). A supplier picks Silver or Gold on
-- /membership, which saves a `pending` row here; they pay off platform and
-- send the screenshot on WhatsApp; an admin approves it from the admin app.
-- company_tiers already reads only status = 'active', so a pending or
-- rejected row never changes the public tier.

alter table public.memberships drop constraint memberships_status_check;
alter table public.memberships add constraint memberships_status_check
  check (status in ('pending', 'active', 'rejected', 'expired', 'cancelled'));

alter table public.memberships add column reviewed_at timestamptz;

-- At most one open request per company (AC-3).
create unique index memberships_one_pending_per_company
on public.memberships (company_id)
where status = 'pending';

-- Activates a pending request in one transaction (AC-8): the company's
-- previous active membership is cancelled first, so the one-active unique
-- index holds at every statement and company_tiers never sees two tiers.
create function public.approve_membership_request(p_membership_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  select m.company_id into v_company_id
  from public.memberships m
  where m.id = p_membership_id and m.status = 'pending'
  for update;

  if v_company_id is null then
    raise exception using errcode = 'P0001', message = 'not_pending';
  end if;

  update public.memberships
  set status = 'cancelled'
  where company_id = v_company_id and status = 'active';

  update public.memberships
  set status = 'active', starts_at = now(), reviewed_at = now()
  where id = p_membership_id;
end;
$$;

revoke execute on function public.approve_membership_request(uuid) from public, anon, authenticated;
grant execute on function public.approve_membership_request(uuid) to service_role;

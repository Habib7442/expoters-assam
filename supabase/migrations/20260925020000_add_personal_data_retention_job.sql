-- DPDP Act s. 8(7): erase personal data once the purpose it was collected
-- for is served. The Privacy Policy (app/privacy/page.tsx, RETENTION)
-- promises enquiries and buy requirements are kept 12 months; this makes
-- that promise true, nightly, via pg_cron.
--
-- Order matters: enquiries first, then buy_requirements (an enquiry's
-- buy_requirement_id is ON DELETE SET NULL, so either order is safe, but
-- purging enquiries first frees more buyers in the same run), then buyers
-- left with no rows at all. buyers.id is ON DELETE RESTRICT from both
-- tables, so a buyer with any surviving row can't be deleted by accident;
-- the NOT EXISTS checks just skip them cleanly instead of erroring. The
-- 1-day floor on buyers.created_at keeps this from ever racing a buyer
-- whose first row is still being written.
--
-- Business listings, products, and account data are NOT purged here: they
-- live until the supplier deletes them (policy: "until deleted, then 30
-- days"), which needs a Clerk user.deleted webhook — not built yet.
-- Membership payment records (8 years) are likewise out of scope here.

create or replace function public.purge_expired_personal_data()
returns table (enquiries_deleted int, buy_requirements_deleted int, buyers_deleted int)
language plpgsql
set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - interval '12 months';
  v_enquiries int;
  v_requirements int;
  v_buyers int;
begin
  delete from public.enquiries where created_at < v_cutoff;
  get diagnostics v_enquiries = row_count;

  delete from public.buy_requirements where created_at < v_cutoff;
  get diagnostics v_requirements = row_count;

  delete from public.buyers b
  where b.created_at < now() - interval '1 day'
    and not exists (select 1 from public.enquiries e where e.buyer_id = b.id)
    and not exists (select 1 from public.buy_requirements r where r.buyer_id = b.id);
  get diagnostics v_buyers = row_count;

  return query select v_enquiries, v_requirements, v_buyers;
end;
$$;

-- Deletes PII in bulk: never callable by the public API roles, only by the
-- cron job (runs as postgres) and service_role for manual/admin runs.
revoke execute on function public.purge_expired_personal_data() from public, anon, authenticated;
grant execute on function public.purge_expired_personal_data() to service_role;

-- The retention cutoff scans created_at on both tables every night.
create index if not exists enquiries_created_at_idx on public.enquiries (created_at);
create index if not exists buy_requirements_created_at_idx on public.buy_requirements (created_at);

create extension if not exists pg_cron with schema pg_catalog;

-- 20:30 UTC = 02:00 IST, off-peak for an India-first directory.
-- cron.schedule upserts by job name, so re-running this is idempotent.
select cron.schedule(
  'purge-expired-personal-data',
  '30 20 * * *',
  $$select public.purge_expired_personal_data()$$
);

-- Scenario test for buyer contact unlocks (spec 0009) and plan expiry (spec 0008).
-- Safe to run against any database, including production: it ends by raising
-- an exception, which rolls back every row it created. Success is the error
-- "ALL_CHECKS_PASSED (rolled back)"; any "FAIL ..." message is a real failure.
--
--   npx supabase db query --linked -f supabase/tests/buyer_contact_unlocks.sql
do $$
declare
  v_company uuid;
  v_buyer uuid;
  r1 uuid; r2 uuid; r3 uuid; r_old uuid; r_private uuid;
  v_new boolean;
  v_state text;
  v_quota int; v_used int;
begin
  insert into public.companies (name, slug, email, submitted_by, status, clerk_user_id)
  values ('Zz Unlock Test Co', 'zz-unlock-test-co', 'zz@test.invalid', 'supplier', 'approved', 'user_zz_unlock_test')
  returning id into v_company;

  insert into public.buyers (name, phone) values ('Zz Buyer', '+919000000001') returning id into v_buyer;

  insert into public.buy_requirements (buyer_id, product_text, quantity, contact_name, is_public, consent_notice_version, consent_given_at)
  values (v_buyer, 'Zz pepper', '1 kg', 'Zz Buyer', true, '2026-10-07', now()) returning id into r1;
  insert into public.buy_requirements (buyer_id, product_text, quantity, contact_name, is_public, consent_notice_version, consent_given_at)
  values (v_buyer, 'Zz tea', '1 kg', 'Zz Buyer', true, '2026-10-07', now()) returning id into r2;
  insert into public.buy_requirements (buyer_id, product_text, quantity, contact_name, is_public, consent_notice_version, consent_given_at)
  values (v_buyer, 'Zz oud', '1 kg', 'Zz Buyer', true, '2026-10-07', now()) returning id into r3;
  insert into public.buy_requirements (buyer_id, product_text, quantity, contact_name, is_public, consent_notice_version, consent_given_at)
  values (v_buyer, 'Zz old', '1 kg', 'Zz Buyer', true, '2026-09-26', now()) returning id into r_old;
  insert into public.buy_requirements (buyer_id, product_text, quantity, contact_name, is_public, consent_notice_version, consent_given_at)
  values (v_buyer, 'Zz private', '1 kg', 'Zz Buyer', false, '2026-10-07', now()) returning id into r_private;

  -- Basic: 1 contact
  select quota, used into v_quota, v_used from public.contact_allowances(array[v_company]);
  if v_quota <> 1 or v_used <> 0 then raise exception 'FAIL basic allowance %/%', v_used, v_quota; end if;

  select newly_unlocked into v_new from public.unlock_buy_requirement('user_zz_unlock_test', r1);
  if not v_new then raise exception 'FAIL first unlock not new'; end if;

  select newly_unlocked into v_new from public.unlock_buy_requirement('user_zz_unlock_test', r1);
  if v_new then raise exception 'FAIL repeat unlock used a credit'; end if;

  begin
    perform public.unlock_buy_requirement('user_zz_unlock_test', r2);
    raise exception 'FAIL basic second unlock allowed';
  exception when sqlstate 'P0012' then null;
  end;

  begin
    perform public.unlock_buy_requirement('user_zz_unlock_test', r_old);
    raise exception 'FAIL old consent unlockable';
  exception when sqlstate 'P0011' then null;
  end;

  begin
    perform public.unlock_buy_requirement('user_zz_unlock_test', r_private);
    raise exception 'FAIL private unlockable';
  exception when sqlstate 'P0004' then null;
  end;

  begin
    perform public.unlock_buy_requirement('user_nobody', r2);
    raise exception 'FAIL unknown user allowed';
  exception when sqlstate 'P0007' then null;
  end;

  -- Real life: the Basic unlock happened before the upgrade (now() is frozen in one transaction).
  update public.buy_requirement_unlocks set created_at = now() - interval '1 minute' where company_id = v_company;

  -- Silver: fresh plan year of 15
  perform public.set_company_plan(v_company, 'silver');
  select quota, used into v_quota, v_used from public.contact_allowances(array[v_company]);
  if v_quota <> 15 then raise exception 'FAIL silver quota %', v_quota; end if;
  perform public.unlock_buy_requirement('user_zz_unlock_test', r2);
  select used into v_used from public.contact_allowances(array[v_company]);
  if v_used <> 1 then raise exception 'FAIL silver used % (expected 1, plan year starts now)', v_used; end if;

  -- Gold: unlimited
  perform public.set_company_plan(v_company, 'gold');
  select quota into v_quota from public.contact_allowances(array[v_company]);
  if v_quota is not null then raise exception 'FAIL gold quota %', v_quota; end if;
  perform public.unlock_buy_requirement('user_zz_unlock_test', r3);

  -- Expired plan falls back to basic
  update public.memberships set expires_at = now() - interval '1 second' where company_id = v_company and status = 'active';
  select tier, quota into v_state, v_quota from public.contact_allowances(array[v_company]);
  if v_state <> 'basic' or v_quota <> 1 then raise exception 'FAIL expired plan is % %', v_state, v_quota; end if;
  select tier into v_state from public.company_tiers where company_id = v_company;
  if v_state <> 'basic' then raise exception 'FAIL company_tiers shows % after expiry', v_state; end if;

  -- Hiding a requirement makes it not unlockable
  update public.buy_requirements set is_public = false where id = r1;
  if (select contact_unlockable from public.buy_requirements where id = r1) then raise exception 'FAIL hidden still unlockable'; end if;

  raise exception 'ALL_CHECKS_PASSED (rolled back)';
end;
$$;

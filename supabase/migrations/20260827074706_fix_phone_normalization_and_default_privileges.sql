-- Fixes two bugs found by /check review of spec 0001, both proven against
-- the linked project before this migration:
--
-- 1. normalize_buyer_phone() rejected two everyday Indian phone formats: a
--    leading-0 STD-prefixed number ("09876543210") and the international
--    "00" dialing prefix ("00919876543210"). Both left a leading zero in
--    front of the "+", which fails buyers_phone_check, so a buyer typing
--    either format got a hard 23514 error instead of a saved enquiry.
--
-- 2. "revoke insert, update, delete on all tables in schema public" (in
--    20260827065400_create_core_schema.sql) only covers tables that exist
--    at the moment it runs. pg_default_acl confirms role postgres's default
--    ACL for schema public still grants anon/authenticated "arwdDxtm" (full
--    privileges, including insert/update/delete) on any table created
--    afterward, contradicting the comment's "future table won't silently
--    become writable" claim. This adds the missing default-privilege
--    revoke so that claim is actually true going forward.

create or replace function public.normalize_buyer_phone()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  digits text;
begin
  new.phone_raw := coalesce(new.phone_raw, new.phone);
  digits := regexp_replace(new.phone, '[^0-9]', '', 'g');

  -- Strip a leading international "00" dialing prefix (e.g. "0091..."),
  -- then a single leading STD trunk "0" on an otherwise bare 10-digit
  -- number (e.g. "09876543210" -> "9876543210"), before applying the
  -- existing +91/+ rule below.
  if left(digits, 2) = '00' then
    digits := substring(digits from 3);
  elsif left(digits, 1) = '0' and length(digits) = 11 then
    digits := substring(digits from 2);
  end if;

  if length(digits) = 10 then
    new.phone := '+91' || digits;
  else
    new.phone := '+' || digits;
  end if;
  return new;
end;
$$;

-- Belt-and-braces for future tables (today's seven tables are already
-- covered by the explicit revoke in the core-schema migration): any table
-- created afterward by role postgres no longer inherits insert/update/
-- delete for anon/authenticated by default.
alter default privileges for role postgres in schema public
revoke insert, update, delete on tables from anon, authenticated;

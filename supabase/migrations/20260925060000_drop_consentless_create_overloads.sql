-- Contract step of the expand/contract in 20260925010000. The storefront
-- that calls the consent-recording overloads is deployed (verified live on
-- 2026-09-25: a new enquiry stored consent_notice_version '2026-09-25'), so
-- the old consent-less overloads have no caller left and are dropped. After
-- this, no database path can create an enquiry, buy requirement, or
-- business listing without a recorded consent notice version.

drop function if exists public.create_enquiry(text, text, text, uuid, text);
drop function if exists public.create_company_enquiry(text, text, text, uuid, text);
drop function if exists public.create_buy_requirement(text, text, text, uuid, text, text, text, text, boolean);
drop function if exists public.create_business_listing(text, text, text, text, text, text, text, text, text, text, text, text);

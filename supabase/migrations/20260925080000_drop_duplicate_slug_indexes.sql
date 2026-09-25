-- Drops two plain indexes on slug that duplicate the unique index each
-- table's unique constraint already builds (companies_slug_key from
-- 20260909033000, products_slug_key from the inline `unique` in
-- 20260827080000). The unique indexes serve every slug lookup on their own;
-- the extra copies only added write and storage cost. Found in the company
-- profile pages review (docs/reviews/2026-09-25-main-company-profile-pages.md).

drop index if exists public.companies_slug_idx;
drop index if exists public.products_slug_idx;

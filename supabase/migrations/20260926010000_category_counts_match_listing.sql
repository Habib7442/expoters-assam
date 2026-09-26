-- The home page category tiles read their counts from this view, and each
-- tile links to /products?category=<slug>. That listing (getProducts) only
-- shows products from approved *and verified* companies, but this view only
-- required approved, so a tile could promise more products than the page it
-- links to shows. Found in the home page review
-- (docs/reviews/2026-09-26-main-home-page.md). Same shape as before, one
-- more condition in the company join's ON clause (not WHERE, so a category
-- with zero products still returns a row with count 0, per AC-5).
--
-- create or replace keeps the existing grant and the deliberate
-- non-security_invoker setting (see 20260910010000).

create or replace view public.category_product_counts as
select
  cat.id as category_id,
  count(c.id) as product_count
from public.categories cat
left join public.products p
  on p.category_id = cat.id and p.status = 'approved'
left join public.companies c
  on c.id = p.company_id and c.status = 'approved' and c.verified
group by cat.id;

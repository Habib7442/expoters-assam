-- CodeRabbit correctly flagged getCategoriesWithProductCounts: it fetches
-- every approved product's category_id and counts them in JS, but
-- PostgREST's max_rows = 1000 (supabase/config.toml) silently truncates a
-- result past that, understating some categories' counts once total
-- approved products crosses 1000, with no error surfaced. A grouped
-- database-side aggregate returns at most one row per category regardless
-- of how many products exist, so it can never hit that truncation.
--
-- LEFT JOINs with the approval filters in the ON clause, not WHERE: a
-- WHERE filter would drop a category from the result entirely once it has
-- zero approved products, but AC-5 requires zero to be a valid, visible
-- count. count(c.id), not count(p.id): a product row survives the first
-- join even when its company isn't approved, and c.id is only non-null
-- when both the product's and its company's status actually match.
create view public.category_product_counts as
select
  cat.id as category_id,
  count(c.id) as product_count
from public.categories cat
left join public.products p
  on p.category_id = cat.id and p.status = 'approved'
left join public.companies c
  on c.id = p.company_id and c.status = 'approved'
group by cat.id;

-- Same reasoning as company_tiers/directory_stats: deliberately NOT
-- security_invoker, exposing one narrow, safe derived fact from tables
-- anon cannot read directly.
grant select on public.category_product_counts to anon, authenticated;

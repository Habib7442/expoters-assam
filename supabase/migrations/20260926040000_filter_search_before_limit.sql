-- CodeRabbit (on 20260926030000) correctly flagged: search_product_ids and
-- search_company_ids capped their ranked matches at 100 before the app
-- applied the category, country and verified filters. A broad query whose
-- top 100 matches sat in other categories or countries, or under
-- unverified companies, showed few or no results even though lower ranked
-- matches existed.
--
-- The filters now run inside the functions, before the limit, matching the
-- list pages' own rules:
--   * products: approved product, approved *and verified* company (the
--     /products page lists "verified exporters"), optional category slug and
--     company country.
--   * companies: approved company, optional country, and optionally at least
--     one approved product in the category.
-- search_buy_requirement_ids has no filters and is unchanged.
--
-- The argument list changes, so these are dropped and recreated (create or
-- replace would add an overload, and two overloads with defaults would make
-- PostgREST calls ambiguous). Still security invoker: every column read here
-- is within the anon column grants.
--
-- Postgres only knows pg_trgm.word_similarity_threshold once the pg_trgm
-- library is loaded in the session; until then it is an unknown
-- "placeholder" setting, and only a superuser may attach one to a function
-- (`permission denied to set parameter`, the first push of this file).
-- 20260926030000 got away with it because its `create extension` loaded the
-- library. Calling any pg_trgm function loads it, so do that first.
select extensions.similarity('', '');

drop function public.search_product_ids(text, integer);
drop function public.search_company_ids(text, integer);

create function public.search_product_ids(
  search text,
  max_results integer default 100,
  category_slug text default null,
  company_country text default null
)
returns table (id uuid, score real)
language sql
stable
security invoker
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.4
as $$
  with q as (
    select btrim(search) as term, public.search_contains_pattern(btrim(search)) as pattern
  )
  select p.id,
         ((p.name ilike q.pattern)::int + extensions.word_similarity(q.term, p.name))::real as score
  from public.products p
  join public.companies c on c.id = p.company_id
  cross join q
  where q.term <> ''
    and p.status = 'approved'
    and c.status = 'approved'
    and c.verified
    and (company_country is null or c.country = company_country)
    and (
      category_slug is null
      or exists (
        select 1 from public.categories cat
        where cat.id = p.category_id and cat.slug = category_slug
      )
    )
    and (p.name ilike q.pattern or q.term operator(extensions.<%) p.name)
  order by score desc, p.id
  limit least(greatest(max_results, 1), 100);
$$;

create function public.search_company_ids(
  search text,
  max_results integer default 100,
  category_slug text default null,
  company_country text default null
)
returns table (id uuid, score real)
language sql
stable
security invoker
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.4
as $$
  with q as (
    select btrim(search) as term, public.search_contains_pattern(btrim(search)) as pattern
  )
  select c.id,
         ((c.name ilike q.pattern)::int + extensions.word_similarity(q.term, c.name))::real as score
  from public.companies c
  cross join q
  where q.term <> ''
    and c.status = 'approved'
    and (company_country is null or c.country = company_country)
    and (
      category_slug is null
      or exists (
        select 1
        from public.products p
        join public.categories cat on cat.id = p.category_id
        where p.company_id = c.id and p.status = 'approved' and cat.slug = category_slug
      )
    )
    and (c.name ilike q.pattern or q.term operator(extensions.<%) c.name)
  order by score desc, c.id
  limit least(greatest(max_results, 1), 100);
$$;

revoke execute on function public.search_product_ids(text, integer, text, text) from public;
revoke execute on function public.search_company_ids(text, integer, text, text) from public;
grant execute on function public.search_product_ids(text, integer, text, text) to anon, authenticated, service_role;
grant execute on function public.search_company_ids(text, integer, text, text) to anon, authenticated, service_role;

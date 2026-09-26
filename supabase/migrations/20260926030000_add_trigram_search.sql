-- Typo tolerant search (scope feature 12, decided 2026-09-26: pg_trgm, no
-- embeddings). Replaces the plain `ilike` name match on products, companies
-- and buy requirements.
--
-- Each search_*_ids function returns matching ids ranked best first:
--   * a literal "contains" match (the old ilike behavior, so short queries
--     like "te" that are too short for trigrams still work), plus
--   * a trigram word similarity match (`<%`), which tolerates typos
--     ("agarwod" finds "Agarwood Chips") and multi word queries in any
--     order ("tea assam" finds "Assam Orthodox Tea").
--
-- security invoker: the functions run as the caller (anon from the public
-- site), so RLS and the column grants from 20260910020000 still apply. They
-- only touch columns anon can already read (id, name/product_text, status /
-- is_public), which is why they return ids, not whole rows: the app then
-- reads the rows it needs through its usual column-listed queries.
--
-- The similarity threshold is lowered from pg_trgm's 0.6 default to 0.4 per
-- function (SET clause, so it never leaks into other sessions): at 0.6 a
-- one letter typo in a short word ("tee" for "tea", 0.5) is missed.

create extension if not exists pg_trgm with schema extensions;

create index if not exists products_name_trgm_idx
  on public.products using gin (name extensions.gin_trgm_ops);
create index if not exists companies_name_trgm_idx
  on public.companies using gin (name extensions.gin_trgm_ops);
create index if not exists buy_requirements_product_text_trgm_idx
  on public.buy_requirements using gin (product_text extensions.gin_trgm_ops);

-- The visitor's text as a literal ilike "contains" pattern: `\`, `%` and `_`
-- are escaped so they match themselves, not act as wildcards (the same rule
-- lib/supabase/like-pattern.ts applied client side before this).
create function public.search_contains_pattern(search text)
returns text
language sql
immutable
set search_path = ''
as $$
  select '%' || replace(replace(replace(search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
$$;

create function public.search_product_ids(search text, max_results integer default 100)
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
  from public.products p, q
  where q.term <> ''
    and p.status = 'approved'
    and (p.name ilike q.pattern or q.term operator(extensions.<%) p.name)
  order by score desc, p.id
  limit least(greatest(max_results, 1), 100);
$$;

create function public.search_company_ids(search text, max_results integer default 100)
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
  from public.companies c, q
  where q.term <> ''
    and c.status = 'approved'
    and (c.name ilike q.pattern or q.term operator(extensions.<%) c.name)
  order by score desc, c.id
  limit least(greatest(max_results, 1), 100);
$$;

create function public.search_buy_requirement_ids(search text, max_results integer default 100)
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
  select b.id,
         ((b.product_text ilike q.pattern)::int + extensions.word_similarity(q.term, b.product_text))::real as score
  from public.buy_requirements b, q
  where q.term <> ''
    and b.is_public = true
    and (b.product_text ilike q.pattern or q.term operator(extensions.<%) b.product_text)
  order by score desc, b.id
  limit least(greatest(max_results, 1), 100);
$$;

-- Read only and RLS bound, so safe for the public roles; granted explicitly
-- rather than leaning on Supabase's default function grants.
revoke execute on function public.search_contains_pattern(text) from public;
revoke execute on function public.search_product_ids(text, integer) from public;
revoke execute on function public.search_company_ids(text, integer) from public;
revoke execute on function public.search_buy_requirement_ids(text, integer) from public;
grant execute on function public.search_contains_pattern(text) to anon, authenticated, service_role;
grant execute on function public.search_product_ids(text, integer) to anon, authenticated, service_role;
grant execute on function public.search_company_ids(text, integer) to anon, authenticated, service_role;
grant execute on function public.search_buy_requirement_ids(text, integer) to anon, authenticated, service_role;

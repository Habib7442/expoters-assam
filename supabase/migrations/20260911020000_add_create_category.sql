-- create_category (admin app): an admin adds a category directly, live
-- immediately (no approval needed, same as an admin-added product). Reuses
-- public.slugify() and the same collision-retry pattern already
-- established for create_business_listing/create_product_submission.

create or replace function public.create_category(p_name text)
returns table (category_id uuid, slug text)
language plpgsql
set search_path = ''
as $$
declare
  v_base_slug text;
  v_slug text;
  v_suffix int := 1;
  v_id uuid;
begin
  v_base_slug := public.slugify(p_name);
  v_slug := v_base_slug;
  -- categories.slug must be table-qualified: the `slug` OUT parameter from
  -- this function's own `returns table` clause is otherwise ambiguous with
  -- the column of the same name (caught live: 42702 ambiguous column).
  while exists (select 1 from public.categories where categories.slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.categories (name, slug) values (p_name, v_slug)
  returning id into v_id;

  return query select v_id, v_slug;
end;
$$;

revoke execute on function public.create_category(text) from public;
grant execute on function public.create_category(text) to service_role;

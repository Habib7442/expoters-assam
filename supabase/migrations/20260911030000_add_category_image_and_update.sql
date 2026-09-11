-- Adds an optional category image (spec 0002's own Follow-up: "Category
-- tiles show no icon in this pass... adding icons later needs no schema
-- change" — this is that later). Nullable: existing categories (and most
-- future ones for a while) have none, and the storefront's tile already
-- falls back to name+count only.

alter table public.categories add column image_url text;

-- Widen create_category to accept the image at creation time, and add
-- update_category for editing name/image afterward (admin app, feature
-- request). image_url uses coalesce so leaving it null on an edit keeps
-- whatever is already there, same pattern as update_business_listing's
-- logo_url handling.

drop function if exists public.create_category(text);

create or replace function public.create_category(p_name text, p_image_url text default null)
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
  while exists (select 1 from public.categories where categories.slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.categories (name, slug, image_url) values (p_name, v_slug, p_image_url)
  returning id into v_id;

  return query select v_id, v_slug;
end;
$$;

revoke execute on function public.create_category(text, text) from public;
grant execute on function public.create_category(text, text) to service_role;

create or replace function public.update_category(p_id uuid, p_name text, p_image_url text default null)
returns table (category_id uuid, slug text)
language plpgsql
set search_path = ''
as $$
declare
  v_slug text;
begin
  select categories.slug into v_slug from public.categories where id = p_id;

  if v_slug is null then
    raise exception using errcode = 'P0004', message = 'category_not_found';
  end if;

  update public.categories
  set name = p_name, image_url = coalesce(p_image_url, image_url)
  where id = p_id;

  return query select p_id, v_slug;
end;
$$;

revoke execute on function public.update_category(uuid, text, text) from public;
grant execute on function public.update_category(uuid, text, text) to service_role;

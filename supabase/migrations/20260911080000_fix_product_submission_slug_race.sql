-- Fixes a real race in create_product_submission: the availability check
-- (`while exists (select ...)`) and the insert were two separate
-- operations. Under READ COMMITTED, two concurrent submissions slugifying
-- to the same base name (e.g. two suppliers both naming a product
-- "Agarwood Chips" at once) can both see the same slug as free and both
-- attempt to insert it — one succeeds, the other raises unique_violation
-- on products' own unique constraint on slug and aborts with no retry,
-- surfacing as a generic server error to a caller who did nothing wrong.
--
-- products has exactly one unique constraint besides its primary key (slug,
-- added by 20260827080000; id collisions via gen_random_uuid() are not a
-- realistic concern), so any unique_violation raised by this insert can
-- only be that slug collision — safe to catch broadly and retry with the
-- next suffix, same signature, so `create or replace` is enough.

create or replace function public.create_product_submission(
  p_clerk_user_id text,
  p_name text,
  p_description text,
  p_category_id uuid,
  p_image_urls text[]
)
returns table (product_id uuid, status text)
language plpgsql
set search_path = ''
as $$
declare
  v_company public.companies;
  v_base_slug text;
  v_slug text;
  v_suffix int := 1;
  v_product_id uuid;
begin
  select * into v_company from public.companies where clerk_user_id = p_clerk_user_id;

  if v_company.id is null then
    raise exception using errcode = 'P0004', message = 'company_not_found';
  end if;

  if v_company.status <> 'approved' then
    raise exception using errcode = 'P0007', message = 'company_not_approved';
  end if;

  if p_image_urls is null or array_length(p_image_urls, 1) is null then
    raise exception using errcode = 'P0008', message = 'no_images';
  end if;

  v_base_slug := public.slugify(p_name);
  v_slug := v_base_slug;

  loop
    begin
      insert into public.products (
        company_id, category_id, name, description, image_url, gallery_urls, status, submitted_by, slug
      )
      values (
        v_company.id, p_category_id, p_name, nullif(btrim(coalesce(p_description, '')), ''),
        p_image_urls[1], p_image_urls, 'pending', 'supplier', v_slug
      )
      returning id into v_product_id;

      exit;
    exception
      when unique_violation then
        v_suffix := v_suffix + 1;
        v_slug := v_base_slug || '-' || v_suffix;
    end;
  end loop;

  return query select v_product_id, 'pending'::text;
end;
$$;

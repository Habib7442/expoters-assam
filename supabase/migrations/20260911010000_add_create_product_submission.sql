-- create_product_submission (feature 16): an approved supplier submits
-- their own product from their own dashboard; it stays pending until an
-- admin approves it in the separate admin app. Gated on the caller's
-- company being approved — a supplier with no company, or a pending/
-- rejected one, cannot submit a product at all, not even a pending one.
--
-- Slug generation mirrors create_business_listing exactly: public.slugify()
-- plus a collision retry loop, done in the database so it's atomic (no
-- race between checking a slug is free and inserting it, unlike the app
-- layer retry-on-23505 pattern the seed script uses for its own reasons).

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
  while exists (select 1 from public.products where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.products (
    company_id, category_id, name, description, image_url, gallery_urls, status, submitted_by, slug
  )
  values (
    v_company.id, p_category_id, p_name, nullif(btrim(coalesce(p_description, '')), ''),
    p_image_urls[1], p_image_urls, 'pending', 'supplier', v_slug
  )
  returning id into v_product_id;

  return query select v_product_id, 'pending'::text;
end;
$$;

revoke execute on function public.create_product_submission(text, text, text, uuid, text[]) from public;
grant execute on function public.create_product_submission(text, text, text, uuid, text[]) to service_role;

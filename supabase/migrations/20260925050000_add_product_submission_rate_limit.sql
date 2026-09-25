-- Spec 0006, AC-5: create_product_submission had no rate limit at all, so
-- one approved supplier account could submit products without bound. Adds
-- a per company cap of 30 submissions per rolling hour, raised as P0010.
--
-- Keyed on the company resolved from the Clerk user id (never a client
-- supplied value), and serialized with a per company advisory lock taken
-- before the count, the same pattern create_enquiry uses per buyer, so two
-- concurrent submissions can't both see 29 and both pass.
--
-- Body otherwise unchanged from 20260911080000 (the slug race fix). Same
-- signature, so create or replace keeps it one function.

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
  v_recent_count int;
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

  perform pg_advisory_xact_lock(hashtext('product_submission:' || v_company.id::text));

  select count(*) into v_recent_count from public.products
  where company_id = v_company.id and created_at > now() - interval '1 hour';

  if v_recent_count >= 30 then
    raise exception using errcode = 'P0010', message = 'rate_limited';
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

-- Restated so this file alone is correct on a fresh database (20260925030000).
revoke execute on function public.create_product_submission(text, text, text, uuid, text[]) from public, anon, authenticated;
grant execute on function public.create_product_submission(text, text, text, uuid, text[]) to service_role;

-- The cap counts one company's products in the last hour on every submit.
create index if not exists products_company_id_created_at_idx on public.products (company_id, created_at desc);

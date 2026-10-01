-- Spec 0007 (product and company management, assumed decision 2026-10-01).
--
-- 1. A `hidden` status on products and companies: taken down by an admin,
--    reversible. Every public read path already requires
--    status = 'approved' (the *_public_select RLS policies, the list and
--    detail queries, the search_* functions, the create_*_enquiry RPCs, the
--    sitemap, category_product_counts), so a hidden row disappears from all
--    of them with no other change. Unlike `rejected`, it carries no
--    rejection_reason (the existing products check already forbids one).
-- 2. update_business_listing keeps a hidden company hidden when its
--    supplier edits the listing, instead of resetting it to pending, so an
--    edit can never undo an admin's take down.
-- 3. update_product_submission: a supplier edits one of their own products.
--    Ownership and state are checked here, not trusted from the caller. The
--    edit always sends the product back to pending for review; the slug is
--    kept so links stay valid.

alter table public.products drop constraint products_status_check;
alter table public.products
add constraint products_status_check check (status in ('pending', 'approved', 'rejected', 'hidden'));

alter table public.companies drop constraint companies_status_check;
alter table public.companies
add constraint companies_status_check check (status in ('pending', 'approved', 'rejected', 'hidden'));

create or replace function public.update_business_listing(
  p_clerk_user_id text,
  p_name text,
  p_location text,
  p_logo_url text,
  p_whatsapp_number text,
  p_about text,
  p_email text,
  p_gst_number text,
  p_state text,
  p_country text,
  p_address_line text,
  p_postal_code text
)
returns table (company_id uuid, status text)
language plpgsql
set search_path = ''
as $$
declare
  v_company public.companies;
  v_next_status text;
begin
  select * into v_company from public.companies where clerk_user_id = p_clerk_user_id;

  if v_company.id is null then
    raise exception using errcode = 'P0004', message = 'company_not_found';
  end if;

  if v_company.updated_at > now() - interval '10 seconds' then
    raise exception using errcode = 'P0006', message = 'rate_limited';
  end if;

  -- An admin's take down survives the supplier's edit (spec 0007).
  v_next_status := case when v_company.status = 'hidden' then 'hidden' else 'pending' end;

  update public.companies
  set
    name = p_name,
    location = p_location,
    logo_url = coalesce(p_logo_url, logo_url),
    about = p_about,
    email = p_email,
    gst_number = p_gst_number,
    state = p_state,
    country = p_country,
    address_line = p_address_line,
    postal_code = p_postal_code,
    status = v_next_status,
    rejection_reason = null
  where id = v_company.id;

  insert into public.company_contacts (company_id, whatsapp_number)
  values (v_company.id, p_whatsapp_number)
  on conflict on constraint company_contacts_pkey
  do update set whatsapp_number = excluded.whatsapp_number;

  return query select v_company.id, v_next_status;
end;
$$;

create function public.update_product_submission(
  p_clerk_user_id text,
  p_product_id uuid,
  p_name text,
  p_description text,
  p_category_id uuid,
  p_image_urls text[]
)
returns table (product_id uuid, status text, slug text)
language plpgsql
set search_path = ''
as $$
declare
  v_company public.companies;
  v_product public.products;
begin
  select * into v_company from public.companies where clerk_user_id = p_clerk_user_id;

  if v_company.id is null then
    raise exception using errcode = 'P0004', message = 'company_not_found';
  end if;

  if v_company.status <> 'approved' then
    raise exception using errcode = 'P0007', message = 'company_not_approved';
  end if;

  -- Locked so two edits of the same product can't interleave.
  select * into v_product from public.products
  where id = p_product_id and company_id = v_company.id
  for update;

  -- Someone else's product looks exactly like a missing one.
  if v_product.id is null then
    raise exception using errcode = 'P0002', message = 'product_not_found';
  end if;

  if v_product.status = 'hidden' then
    raise exception using errcode = 'P0011', message = 'product_hidden';
  end if;

  if v_product.updated_at > now() - interval '10 seconds' then
    raise exception using errcode = 'P0006', message = 'rate_limited';
  end if;

  if p_image_urls is null or array_length(p_image_urls, 1) is null then
    raise exception using errcode = 'P0008', message = 'no_images';
  end if;

  update public.products
  set
    name = p_name,
    description = nullif(btrim(coalesce(p_description, '')), ''),
    category_id = p_category_id,
    image_url = p_image_urls[1],
    gallery_urls = p_image_urls,
    status = 'pending',
    rejection_reason = null
  where id = v_product.id;

  return query select v_product.id, 'pending'::text, v_product.slug;
end;
$$;

revoke execute on function public.update_business_listing(text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_business_listing(text, text, text, text, text, text, text, text, text, text, text, text) to service_role;
revoke execute on function public.update_product_submission(text, uuid, text, text, uuid, text[]) from public, anon, authenticated;
grant execute on function public.update_product_submission(text, uuid, text, text, uuid, text[]) to service_role;

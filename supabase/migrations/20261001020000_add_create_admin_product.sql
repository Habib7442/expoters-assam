-- An admin adds a product directly to a company, from the separate admin
-- app (PRD Section 4: "products you (admin) add yourself go live
-- immediately, no approval step needed"; AGENTS.md Section 6 and the
-- products.submitted_by = 'admin' value already in the data model).
--
-- Mirrors create_product_submission (the same unique slug retry loop and
-- image rules) with three differences: the caller names the company
-- (no Clerk ownership lookup; only the requireAdmin gated admin app holds
-- the service role key that can run this), the row is created `approved`
-- with submitted_by = 'admin', and there is no per company rate limit.
-- The company must itself be approved, since a product under any other
-- company status would not be shown anyway.

create function public.create_admin_product(
  p_company_id uuid,
  p_name text,
  p_description text,
  p_category_id uuid,
  p_image_urls text[]
)
returns table (product_id uuid, slug text)
language plpgsql
set search_path = ''
as $$
declare
  v_company_status text;
  v_base_slug text;
  v_slug text;
  v_suffix int := 1;
  v_product_id uuid;
begin
  select c.status into v_company_status from public.companies c where c.id = p_company_id;

  if v_company_status is null then
    raise exception using errcode = 'P0004', message = 'company_not_found';
  end if;

  if v_company_status <> 'approved' then
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
        p_company_id, p_category_id, p_name, nullif(btrim(coalesce(p_description, '')), ''),
        p_image_urls[1], p_image_urls, 'approved', 'admin', v_slug
      )
      returning id into v_product_id;

      exit;
    exception
      when unique_violation then
        v_suffix := v_suffix + 1;
        v_slug := v_base_slug || '-' || v_suffix;
    end;
  end loop;

  return query select v_product_id, v_slug;
end;
$$;

revoke execute on function public.create_admin_product(uuid, text, text, uuid, text[]) from public, anon, authenticated;
grant execute on function public.create_admin_product(uuid, text, text, uuid, text[]) to service_role;

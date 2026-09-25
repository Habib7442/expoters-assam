-- Enforce the slug format at the database, not just in the code that
-- generates it (spec 0003 AC-7: every slug is unique, URL safe, and non
-- empty). Until now only `not null` and `unique` were enforced, so any
-- writer bypassing public.slugify()/generateSlug() (a direct service role
-- insert, a future admin tool, a hand edit) could store '' or 'Not URL Safe!'
-- and produce a broken or unroutable URL.
--
-- The pattern is exactly what every existing writer already produces:
-- public.slugify() and generateSlug() (lowercase a-z0-9 runs joined by single
-- hyphens, no leading/trailing hyphen), plus the collision suffixes appended
-- to them ('-2', '-<8 hex chars>'). It rejects the empty string by itself.
-- Every live row was checked against it before this migration was written;
-- the tables are tiny, so the constraints are validated immediately.

alter table public.products
  add constraint products_slug_format_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.companies
  add constraint companies_slug_format_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.categories
  add constraint categories_slug_format_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

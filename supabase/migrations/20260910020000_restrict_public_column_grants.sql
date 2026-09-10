-- CodeRabbit correctly flagged: companies had a table-wide `grant select`
-- to anon/authenticated (spec 0001), and companies.email was added later
-- (spec 0005) without revisiting that grant. RLS policies restrict ROWS,
-- never columns, so any approved company's business email is readable
-- today by anyone with the public anon key, via a direct REST call against
-- Supabase's API, entirely bypassing this app's own queries (none of which
-- currently select email publicly, but that was never actually enforced by
-- the database, only by every future query's author remembering not to).
--
-- Investigating this surfaced the identical pattern on buy_requirements:
-- contact_name, contact_email, and buyer_id are covered by that table's own
-- blanket grant from day one, exploitable the same way even though
-- getLatestBuyRequirements never selects them. Same fix, same migration.
--
-- Column-level grants, not a new view: no current public query needs a
-- view's added indirection here (unlike company_tiers/directory_stats,
-- which aggregate across otherwise-locked-down tables), and every existing
-- anon-client query already selects an explicit column list that fits
-- entirely within the narrowed grant below, so this changes no application
-- code. supabaseAdmin (service_role) is unaffected: service_role's grants
-- are separate and unrestricted by this.

revoke select on public.companies from anon, authenticated;
grant select (
  id, slug, name, logo_url, about, location, country, verified, status, created_at
) on public.companies to anon, authenticated;

revoke select on public.buy_requirements from anon, authenticated;
grant select (
  id, product_text, quantity, location, is_public, created_at
) on public.buy_requirements to anon, authenticated;

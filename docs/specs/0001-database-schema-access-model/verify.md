# Verify: database schema & access model · spec 0001 · updated 2026-08-27
_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands

- [x] `supabase migration list --linked` → local migration timestamps match remote → AC-1
- [x] `select table_name from information_schema.tables where table_schema = 'public'` → all 7 tables + `company_tiers` + `directory_stats` present → AC-1
- [x] `supabase db advisors --linked --type all` → only the two `security_definer_view` findings on `company_tiers`/`directory_stats` remain (documented, deliberate) → Security model
- [x] `curl` the REST API with the anon publishable key against `companies`/`products` → only `status = 'approved'` rows returned, a `pending` row never appears → AC-2, AC-8
- [x] Same anon call against `buy_requirements` → only `is_public = true` rows returned → AC-2
- [x] Same anon call against `buyers`, `enquiries`, `memberships` → empty result → AC-2
- [x] Anon `POST` (insert) against any table → `401`, no row created → AC-2
- [x] Anon `POST` to `rpc/get_or_create_buyer` → `401` → security model (service_role only)
- [x] Insert a company/product with a blank or whitespace-only `name` (or a product with a blank `image_url`) → rejected by the `CHECK` constraint → AC-3
- [x] Call `get_or_create_buyer` twice for the same number typed two ways (e.g. `9876543210` and `+91 98765 43210`), second call adding an email the first omitted → both resolve to the same `buyers.id`, `phone` normalized identically, `email` backfilled only because it was null, `name` from the first call is not overwritten by the second → AC-4, AC-9
- [x] Delete a `products` row that an `enquiries` row references → delete succeeds, the `enquiries` row survives with `product_id` null and its snapshot columns (`product_name`, `contact_name`) intact → AC-5
- [x] Delete a `buyers` row that has any `enquiries`/`buy_requirements` history → rejected by the FK (`23503`) → AC-5
- [x] Insert a second `memberships` row with `status = 'active'` for a company that already has one → rejected by `memberships_one_active_per_company` (`23505`) → AC-6
- [x] Insert a `memberships` row reusing an existing `razorpay_payment_id` → `on conflict (razorpay_payment_id) do nothing` is a no-op, not an error, and the company still has exactly one `active` row → AC-6
- [x] Query `company_tiers` for a company with an `active` membership → returns that membership's `tier`; for a company with none → returns `'basic'` → AC-7

## Acceptance-criteria coverage

- AC-1 (tables/views/types exist) → migration-list + information_schema step
- AC-2 (RLS + explicit revoke) → the anon REST API steps
- AC-3 (blank name/image_url rejected) → blank-name insert step
- AC-4 (phone dedup, concurrent-safe, email backfill-only) → `get_or_create_buyer` step
- AC-5 (delete never loses/blocks wrongly) → product-delete and buyer-delete steps
- AC-6 (unique payment id, one active membership) → the two `memberships` steps
- AC-7 (tier always via `company_tiers`) → the `company_tiers` query step
- AC-8 (pending invisible, approved visible) → the anon `companies`/`products` step
- AC-9 (phone always normalized) → the `get_or_create_buyer` step

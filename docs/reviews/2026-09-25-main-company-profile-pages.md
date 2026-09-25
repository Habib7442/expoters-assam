# Review, main, 2026-09-25

**Reviewed by**: Claude Opus (author on Claude Sonnet 5, tests authored on Claude Opus)
**Scope**: 8 files, feature review at HEAD (scope feature 5, company profile pages, decided inline, no spec) plus 3 uncommitted test files
**Verdict**: Approve with nits
**Follow-up (2026-09-25)**: 4 of the 5 minor findings were fixed after review (marked **Resolved** below). The slug race retry item stays open for the next `/check verify`. The product embed limit was left out on purpose (see its note).

## Summary

This adds a public `/companies/[slug]` profile page for each approved company. It shows the logo, about text, location, product grid, Verified badge, Silver/Gold tier badge and Send Enquiry. The data comes from `getCompanyBySlug`, which reads `companies` with its `products` embedded through the anon client. The migrations add `companies.slug` (nullable, then backfilled, then made not null and unique), give `create_business_listing` slug assignment with a bounded retry scoped to `companies_slug_key` for the check-then-insert race, and add a URL-safe format CHECK on every slug column. The visibility guarantee is sound. Both `companies` and `products` have `status = 'approved'` RLS policies for `anon`, the column grant covers exactly the fields the page reads, and /check verify confirmed live that a pending company returns 404 and a pending product stays hidden. Nothing blocks merge. The remaining findings are consistency and defense-in-depth items: status filtering relies on RLS alone, a type-erasing cast, an unordered and unbounded product embed, a duplicate index, and a SQL retry path that no automated check exercises.

## Minor

### 🟡 Status filtering relies on RLS alone, unlike every sibling read path, `lib/supabase/queries/companies.ts:146`
**Problem**: `getCompanyBySlug` filters only on `.eq("slug", slug)`. It depends entirely on the `companies_public_select` and `products_public_select` policies (`status = 'approved'`) to hide pending or rejected companies and products. `getCompanies` (line 86) and `getProductBySlug` (`products.ts:109`) both add `.eq("status", "approved")` explicitly on top of RLS.
**Why it matters**: The behavior is correct today, and AGENTS.md makes RLS the required control, so this is not a hole. But this is the one public read path with no second layer. If the query is ever moved to `supabaseAdmin` (for example, to read a column that isn't granted) or the policy is loosened, a pending company and all its unapproved products would appear on a public page. The same query written elsewhere would fail safe. The inconsistency also makes the code harder to review, because each reader has to check whether RLS was meant to be the only filter.
**Suggested fix**: Add `.eq("status", "approved")` on the company and a `products.status = approved` filter on the embed. `status` is already in the anon column grant. Alternatively, update the doc comment to say RLS is deliberately the only filter here and why.
**Resolved**: `getCompanyBySlug` now adds `.eq("status", "approved")` and `.eq("products.status", "approved")` on top of RLS, with a test asserting both. Live check: the pending company still returns 404.

### 🟡 `as unknown as` cast erases the embed's generated type, `lib/supabase/queries/companies.ts:167`
**Problem**: `(product as unknown as { categories: { name: string } | null })?.categories?.name` bypasses type checking for the nested `categories` embed. `database.types.ts` has the `products_category_id_fkey` relationship, and `getProductBySlug` reads `data.categories` with no cast, so the generated types very likely support this already. The `?.` after the cast is also dead code, because `product` is never nullish inside `.map`.
**Why it matters**: A double cast is effectively an `any` (AGENTS.md: explicit types, no `any`). If the embed is renamed, the column is dropped or the relationship becomes ambiguous, this line still compiles and silently yields `null` for every category.
**Suggested fix**: Remove the cast, read `product.categories?.name ?? null` and let `tsc --noEmit` confirm it. If inference really does fail for a doubly nested embed, add a named row type with a one-line comment explaining why, not `unknown`.
**Resolved**: the cast is gone; the line now reads `product.categories?.name ?? null`, and `tsc --noEmit` passes, so the generated types did support the embed.

### 🟡 Product embed has no order and no limit, `lib/supabase/queries/companies.ts:143`
**Problem**: `products ( id, slug, name, image_url, categories ( name ) )` has no `order` and no `limit`. PostgREST returns embedded rows in unspecified order, and the page renders every one of them.
**Why it matters**: The grid order can change between requests and deploys. That makes the page look unstable, and if caching is ever added it would also cause needless ISR/HTML churn. Every other list query in the codebase orders by `created_at desc, id`. Also, a Gold supplier with a large catalogue would put every product into a single response with no cap.
**Suggested fix**: Add `.order("created_at", { referencedTable: "products", ascending: false })` (plus `id` as a tiebreaker) and a reasonable `referencedTable` limit. Add a "view all" link to `/products` filtered by company if a cap is ever hit.
**Resolved (ordering only)**: products are now ordered `created_at desc, id asc` via `referencedTable: "products"`, with a test. The limit was left out on purpose: the page's "N products" count is the length of this same list, so a cap would make the count wrong. A separate count plus a "view all" link is owed once a company's catalogue gets large.

### 🟡 Duplicate index on `companies.slug`, `supabase/migrations/20260909033000_add_company_slug.sql:36`
**Problem**: `companies_slug_key unique (slug)` already creates a unique btree index on `slug`. `create index companies_slug_idx on public.companies (slug)` adds a second, identical index.
**Why it matters**: The second index adds no query benefit, costs extra on every insert and update, and uses extra storage. This is the duplicate-index anti-pattern in supabase-postgres-best-practices. The cost is small now but permanent.
**Suggested fix**: Add a follow-up migration with `drop index if exists public.companies_slug_idx;`. Check whether `products` has the same pair while you are there.
**Resolved**: `20260925080000_drop_duplicate_slug_indexes.sql` drops `companies_slug_idx` and `products_slug_idx` (products had the same pair). Applied live; a duplicate slug still fails with `23505` on both tables.

### 🟡 Slug race retry branch in `create_business_listing` has no automated or recorded verification, `supabase/migrations/20260925040000_fix_business_listing_slug_race.sql:75-83`
**Problem**: The `unique_violation` handler branches on `constraint_name`. It retries on `companies_slug_key`, re-raises `companies_clerk_user_id_key`, and gives up at 50 retries. This is branching error-handling logic. Today's verify run proved not null (23502) and unique (23505) on the column, but nothing records that concurrent same-name signups end up with distinct slugs, or that a duplicate `clerk_user_id` still surfaces as `already_listed`. The equivalent product race was verified live (0003 verify.md, AC-7). The vitest suite covers only the server action's mapping of a mocked 23505.
**Why it matters**: A wrong constraint name, for example after a future rename, would silently turn the retry back into an unrecoverable signup failure.
**Suggested fix**: In the next `/check verify`, run the same concurrent-RPC probe used for `create_product_submission` against `create_business_listing`: N same-name calls at once from different Clerk IDs, then one duplicate call from the same Clerk ID. Record the result.

## Nits

- ⚪ `supabase/migrations/20260925040000_fix_business_listing_slug_race.sql:78`, the `v_suffix >= 50` bound also counts the probe loop's increments. A name with 50 or more existing same-slug companies raises on its first race collision instead of retrying. This is harmless in practice, but the bound means "suffix 50", not "50 retries" as the header comment says.
- ⚪ `supabase/migrations/20260909033000_add_company_slug.sql:46`, `slugify` strips every non-ASCII character. An all-Assamese or all-Hindi business name becomes `company`, `company-2` and so on, and accented Latin names lose letters (`Café` becomes `caf`). This is acceptable for now but worth a transliteration pass before launch in a multilingual market.
- ⚪ `lib/supabase/queries/companies.ts:114,126`, `categoryName?` and `createdAt?` are optional even though the mapper always sets them. The page's `company.createdAt ? ... : null` guard exists only because of that looseness.
- ⚪ `app/companies/[slug]/page.tsx:23`, `about.slice(0, 155)` can cut mid-word or split a surrogate pair. This mirrors the product page, so fix both together if at all.
- ⚪ `app/companies/[slug]/page.tsx:17-30`, the page has no canonical URL and no `Organization` JSON-LD. This is consistent with the product page, so leave it for the planned SEO pass (PRD Sections 8–9).
- ⚪ `lib/supabase/queries/companies.test.ts:14-16`, the test mocks `isR2Url` with a reimplementation, so the "drops a non-R2 logo" cases test the mock and not the real guard. Import the real `@/lib/storage/r2` if it has no side effects.
- ⚪ `app/companies/[slug]/page.test.ts:213-220`, the "escapes a company name" test asserts React's own escaping, not app behavior. It is harmless but low value.

## Strengths

- The visibility model is correct and verified end to end. Public reads go through the anon client, so the `approved` RLS policies on both `companies` and the embedded `products` actually apply. The column grant (`20260911060000`) exposes nothing beyond what the page renders, and there is no email or WhatsApp number. `getCompanyBySlug` also throws on a database error rather than returning `null`, so an outage is not shown as a 404.
- The slug migrations are careful work. Existing rows get a collision-proof backfill before `not null` and `unique` are applied, the slug stays stable across renames, the race retry is scoped to `companies_slug_key` so the one-company-per-user error stays intact, and a database-level format CHECK makes every writer produce routable URLs. The 6-arg overload bug in `20260909033000` was caught live and fixed with a clear explanation (`20260909051500`).
- The page handles its edge cases deliberately: products with a non-R2 image are kept with a placeholder instead of silently dropped, product counts are pluralized correctly, "Member since" uses the UTC year, and a company with no products gets its own enquiry CTA.

## Test coverage

The three new files are reasonable and aimed at behavior, not trivia:
- `companies.test.ts` covers the profile mapping, the public client versus service-role separation (it asserts that `supabaseAdmin` is never touched), the null-versus-throw contract, the R2 guards and the empty and uncategorized product cases. It also backfills `getCompanies` and `getMyCompany`.
- `page.test.ts` covers the 404 path (and that the tier is not fetched for it), badges for every tier, the empty state with its second CTA, pluralization, the UTC year, fallback rendering and all four `generateMetadata` branches.
- `exporter-card.test.ts` covers the slug link, the logo fallback and the Verified badge.

Two limits are inherent to mocking the query builder. First, no unit test can prove that RLS hides pending rows. That guarantee rests on /check verify's live run, which did prove it. Second, the builder stub makes every filter chainable, so the "public client" test would still pass if a filter were accidentally removed. This matters more if the explicit status filter recommended above is added. In that case, assert `eq("status", "approved")` the way the `getCompanies` test already does. Nothing automated covers the migrations' SQL logic (backfill dedup, slug race retry), which is noted above as a verify item and not a unit-test gap.

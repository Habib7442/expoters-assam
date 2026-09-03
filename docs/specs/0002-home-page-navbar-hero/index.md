# 0002 · Home page

**Date**: 2026-08-27
**Status**: In Progress

## Summary

This spec now covers the whole home page, not just the navbar and hero. The navbar, hero, why-us band, and footer were already built from a written brief and are unchanged here. This update designs the four sections that were still placeholders: the category grid, featured products, featured exporters, and latest buy requirements, plus wiring the hero's stats strip to real numbers. Nothing in this pass needs a new table or column; every value comes from data that already exists.

## Requirements

**User stories**:
- As a visitor, I want to browse products by category from the home page, so I can find what I'm looking for without knowing exactly what to search for.
- As a visitor, I want to see a sample of real products and exporters on the home page, so I trust the directory has real content before I dig deeper.
- As a visitor, I want to see recent buy requirements, so I understand this is a live, two sided marketplace.
- As a visitor, I want the stats strip (verified exporters, products, buyers, countries) to show real numbers, so the site doesn't look like an empty shell.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: Every page shows the slim top bar and sticky white header with logo, the four nav links, the search bar (scope dropdown + button, non functional), and the signed out/signed in auth controls. *(already built)*
- **AC-2**: The home page shows the category chip row and the hero block (heading, sub line, two CTAs, stats strip, blank image placeholder) styled on `--green-wash`. *(already built, stats strip now shows real numbers per AC-9)*
- **AC-3**: All colors, radii, and fonts come from the existing tokens (`app/globals.css`), no new hardcoded hex values. *(already built, still applies to the new sections)*
- **AC-4**: Responsive: the header collapses sensibly on mobile, the hero stacks single column on small screens. *(already built)*
- **AC-5**: The home page shows a category grid listing every row in `categories`, ordered alphabetically by name, each tile showing the category name and a live count of products that are `approved` **and** whose company is also `approved` (the same invariant as AC-6, computed as one aggregate query, not one query per category). Zero is a valid, shown count; a category is never hidden for having no products yet.
- **AC-6**: The home page shows a Featured Products section of up to 8 products, each an `approved` product whose company is also `approved`, ordered by `created_at desc` with `id asc` as a tie break, each card linking to its real `/products/[slug]` page. Fewer than 8 existing shows fewer cards, never a padded or placeholder card. No cap on how many of these 8 slots one company may occupy.
- **AC-7**: The home page shows a Featured Exporters section of up to 6 `approved` companies, ordered by `created_at desc` with `id asc` as a tie break, each card showing the company's name, an initials avatar when it has no logo, its location (falling back to `country` when `location` is null), and a verified badge when `verified` is true. Cards are not clickable in this pass (no company profile page exists yet). Fewer than 6 existing shows fewer cards. No cap on how many of these 6 slots one company may occupy.
- **AC-8**: The home page shows a Latest Buy Requirements section of up to 5 rows from `buy_requirements` where `is_public = true`, selecting only `id, product_text, quantity, location, created_at` (never `contact_name`, `contact_email`, or `buyer_id`, even though RLS technically permits reading them), ordered by `created_at desc` with `id asc` as a tie break, each row's posted time shown as an absolute server rendered date, never a relative "x days ago" string. When zero such rows exist, the whole section (heading included) is absent from the rendered page, not an empty state message.
- **AC-9**: The hero's stats strip (Verified Exporters, Products, Global Buyers, Countries) reads its four numbers from the existing `directory_stats` view instead of the placeholder numbers currently hardcoded, each rendered as a plain locale formatted integer with no `+` suffix; a genuine zero renders as `0`.
- **AC-10**: A company card (Featured Exporters) whose `logo_url` is null renders an initials avatar (the company name's first character, `--green-wash` background, green text, the same token pair used elsewhere on the page) instead of a broken image or a generic placeholder graphic.
- **AC-11**: If any one section's Supabase query returns an error, that section's query helper catches it, logs it server side, and returns `null` instead of throwing; `app/page.tsx` treats a `null` result as "omit this section" and renders every other section normally. A single section's failure never produces a page level error or a broken layout.

## Decision

**Chosen option**: Option 1: Most recently approved.

Featured Products and Featured Exporters are ordered by recency (approval time when available, creation time otherwise), capped at 8 and 6 respectively; no schema change, no manual curation step, and a clean seam for scope feature 11 to add tier based ranking later.

Full options considered and the reasoning behind this choice: [rationale.md](rationale.md).

## Feature design

**Data model sketch**: No new tables or columns. Reuses `categories`, `products` (`status`, `approved_at`, `created_at`), `companies` (`status`, `verified`, `created_at`, `logo_url`), `buy_requirements` (`is_public`, `created_at`), and the existing `directory_stats` view (`verified_exporters`, `products`, `buyers`, `countries`).

**API surface**:
| Surface | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/` (home page) | Page (RSC) | none | category grid, featured products, featured exporters, latest buy requirements, stats strip | public | a single section's query failure is caught and that section omitted (AC-11), never a page level error |

No server actions or API routes: every value here is a read, made with the existing anon Supabase client, the same pattern as `lib/supabase/queries/products.ts`.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Render category grid | category name, slug | `categories` row (anon client, public RLS) |
| Render category grid | ordering | `name asc` |
| Render category grid | product count per category | one aggregate query counting `products` where `category_id` matches, `products.status = 'approved'`, **and** the product's `companies.status = 'approved'` (same invariant as Featured Products), not one query per category |
| Render Featured Products | product name, image, slug, company name | `products` inner joined to `companies` (`status = 'approved'` on both, same pattern as spec 0003's product page query) |
| Render Featured Products | ordering | `created_at desc, id asc`, limit 8, no per-company cap |
| Render Featured Exporters | company name, logo/initials, location, verified badge | `companies` row where `status = 'approved'` |
| Render Featured Exporters | ordering | `created_at desc, id asc`, limit 6, no per-company cap |
| Render Featured Exporters | initials avatar fallback | `company.name`'s first character on a `--green-wash`/green token background, computed at render time when `logo_url` is null |
| Render Featured Exporters | location fallback | `companies.country` (not null, defaults `'India'`) when `location` is null |
| Render Latest Buy Requirements | product text, quantity, location, posted time | `buy_requirements` row, explicit column list `id, product_text, quantity, location, created_at` only, never `contact_name`/`contact_email`/`buyer_id` |
| Render Latest Buy Requirements | ordering / presence | `created_at desc, id asc`, limit 5; section omitted entirely when the query returns 0 rows |
| Render Latest Buy Requirements | posted time format | absolute server formatted date from `created_at`, not a relative string |
| Render stats strip | verified exporters, products, buyers, countries counts | `directory_stats` view, single row, one query |
| Render stats strip | number format | locale formatted integer, no `+` suffix, `0` shown as `0` |

**Key invariants**:
- Featured Products and the category product count only ever count a product whose company is also `approved`, never trusted from a flag on the product row alone (same invariant spec 0003 established for the product page and `create_enquiry`).
- A category tile is never hidden for having zero approved products; the count itself can be zero.
- Latest Buy Requirements either renders 1 to 5 items or does not render its heading/section at all; it never renders an empty state message in this pass (AC-8).
- Latest Buy Requirements never selects or ships `contact_name`, `contact_email`, or `buyer_id` to the browser, even though `is_public` RLS technically permits reading the full row; the query names its column list explicitly.
- A missing `logo_url` always renders the initials avatar fallback (`--green-wash` background, green text), never a broken `<img>` or a generic stock placeholder; a missing `location` always falls back to `country`.
- Every recency ordering (Featured Products, Featured Exporters, Latest Buy Requirements) includes `id asc` as a secondary sort, so ties never produce a nondeterministic or untestable order.
- No cap on how many Featured Products/Featured Exporters slots one company can occupy in this pass; accepted for now given the current catalog size (see Consequences and Follow-up).
- **Each query helper owns its own failure handling**, not the page: `getCategoriesWithProductCounts`/`getFeaturedProducts`/`getFeaturedExporters`/`getLatestBuyRequirements`/`getDirectoryStats` each check the Supabase client's returned `error` internally (supabase-js resolves `{ data, error }`, it never rejects, so there is nothing for a `try/catch` or `Promise.allSettled` to catch), log the error server side, and return `null` on failure. `app/page.tsx` fetches all five in parallel (`Promise.all` over calls that each already resolve to a value or `null`) and renders a section only when its result is not `null`. One section's failure never affects another's render, and never produces a page level error.

**Security model**: Every read in this feature goes through the anon Supabase client under the RLS policies spec 0001 already put in place: `categories` (all rows, public), `companies`/`products` (`status = 'approved'` only), `buy_requirements` (`is_public = true` only), `directory_stats` (a view over aggregate counts only, no row level data). No new public exposure, no new column, nothing sensitive in any value this feature reads.

**Configuration required**: none. No new environment variables or credentials.

**Critical test scenarios**:
- Happy path: the category grid shows all seeded categories in alphabetical order, each with a correct live product count that excludes any product whose company isn't approved, verifies **AC-5**
- Happy path: Featured Products shows up to 8 approved products from approved companies, most recently created first, each linking to a working `/products/[slug]` page, verifies **AC-6**
- Happy path: Featured Exporters shows up to 6 approved companies, most recently created first, a company with no `logo_url` shows an initials avatar, a company with no `location` shows its `country` instead, a `verified` company shows its badge, verifies **AC-7**, **AC-10**
- Happy path: the stats strip shows the real `directory_stats` counts as plain formatted integers, not the old placeholder numbers, verifies **AC-9**
- Failure case: zero public buy requirements exist, the Latest Buy Requirements section (including its heading) does not appear anywhere on the page, verifies **AC-8**
- Failure case: a raw anon query against `buy_requirements` for the public columns never returns `contact_name`/`contact_email`/`buyer_id` from the app's own query (inspect the network response), verifies **AC-8**
- Failure case: `getFeaturedProducts` is made to return a Supabase error (point it at a bad query), the rest of the home page still renders correctly, the Featured Products section is simply missing, and no page level error appears, verifies **AC-11**
- Edge case: fewer than 8 approved products (or fewer than 6 approved companies) exist, the section shows exactly that many cards, no padding, no placeholder cards, verifies **AC-6**, **AC-7**
- Edge case: two products share the same `created_at` (or close enough to collide), the list still renders in a stable, repeatable order across reloads, verifies **AC-6**, **AC-7**, **AC-8**

## Build plan

1. [x] Add `lib/supabase/queries/home.ts`: `getCategoriesWithProductCounts()`, `getFeaturedProducts(limit)`, `getFeaturedExporters(limit)`, `getLatestBuyRequirements(limit)`, `getDirectoryStats()`, each a plain anon client read per the Value sourcing table above, each checking its own `{ data, error }` result, logging and returning `null` on `error` rather than throwing (AC-11), satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-11**
2. [x] Build the new presentational components: a category tile/grid, a product card (or reuse one if feature 4 already built a suitable one), an exporter card with the initials avatar and location/country fallback, and a buy requirement card with an absolute formatted date, all styled from the existing tokens (`app/globals.css`) per AC-3, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-10**
3. [x] Wire the five queries into `app/page.tsx`, fetched in parallel (`Promise.all`), rendering a section only when its result is not `null`, in page order: category grid, Featured Products, Featured Exporters, Latest Buy Requirements (conditionally rendered per AC-8), positioned between the existing hero and the existing Why ExportsAssam band, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-11**. Also added `export const dynamic = "force-dynamic"` — without it Next prerendered `/` as static at build time, freezing the Supabase data instead of reading it live per request.
4. [x] Replace the hero's hardcoded stats strip numbers with `getDirectoryStats()`'s real counts, locale formatted, satisfies **AC-9**. The stats strip itself did not actually exist in the codebase yet (spec context assumed it was already built); this task built the strip markup and wired it, matching the AC's plain-integer, zero-shows-as-zero contract.
5. [ ] Manual verification against every Critical test scenario above, including the empty buy requirements case, the PII column check, and a simulated section query failure, satisfies **AC-5** through **AC-11** — a smoke test against the live dev server confirmed real data renders correctly (category with count, product card, exporter card with initials avatar and verified badge, real stat numbers, Latest Buy Requirements correctly omitted with 0 public rows); the exhaustive pass (forced query failure, tie-break ordering, PII network inspection) is left for `/check verify`.

## Consequences

**Positive**:
- The home page finally shows real, live data end to end, the same proof the core loop (feature 4) already gave the product page.
- Zero migrations: everything reuses schema spec 0001 already shipped.
- The ordering rule has an obvious, named upgrade path (scope feature 11's tier based ranking) instead of a dead end.

**Negative / tradeoffs**:
- "Most recently created" is not a real merit signal; a long standing excellent supplier gets no visibility boost over one approved yesterday. Accepted for now, revisit at feature 11.
- Featured Exporters cards are not clickable in this pass, since there is no company profile page yet (scope feature 5). A visitor sees a card they cannot follow through on.
- `products.approved_at` exists in the schema and is not used by this ordering, since nothing in this repo currently sets it; Featured Products orders by `created_at` instead. If an approve action later starts populating `approved_at` (likely in the separate admin app), this ordering should switch to use it (see Follow-up).
- No cap on how many Featured Products/Exporters slots one company can occupy; with a lopsided catalog (one supplier with many approved products) that supplier could dominate both sections. Accepted for now given the current small catalog.

**Neutral**:
- Category tiles show no icon in this pass, name and count only, until real icon assets are supplied; adding icons later needs no schema change.
- The home page is force-dynamic (`export const dynamic = "force-dynamic"`), not ISR/`revalidate`, consistent with spec 0003's product page (which is dynamic by virtue of its dynamic route param); caching is a Follow up for feature 13, not decided here, since no performance problem has been measured yet.

## Follow-up

- [ ] Revisit the Featured Products/Featured Exporters ordering and the no-cap-per-company decision once scope feature 11 (membership plans & Razorpay) ships, to blend in a tier based ranking boost, per the PRD's stated membership benefit.
- [ ] Make Featured Exporters cards clickable once scope feature 5 (company profile pages) exists.
- [ ] Confirm whether the separate admin app's product approval action sets `products.approved_at`; if it starts doing so, switch Featured Products' ordering from `created_at` to `approved_at` to actually reflect approval recency.
- [ ] Consider ISR/`revalidate` for the home page once real traffic patterns are known; scope feature 13 (SEO & GEO) is the natural place to decide this, not this pass.
- [ ] If a future feature needs true approval time ordering for companies (not just creation time), add a `companies.approved_at` column mirroring `products.approved_at`; not added now since nothing in this pass strictly needs it and it would need coordinated writes from the separate admin app.
- [ ] Feature 15 (Cloudflare R2 image storage) is mid migration; if it lands between this spec and its build, confirm `next.config.ts`'s image host config covers wherever Featured Products' images actually live at build time.

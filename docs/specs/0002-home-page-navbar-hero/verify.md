# Verify: home page · spec 0002 · updated 2026-09-03

_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Visit `/` with at least one seeded category → the "Shop by Category" grid shows every category alphabetically, each tile shows a live product count that excludes products whose company isn't approved → AC-5
- [ ] Visit `/` with a category that has zero approved products → its tile still shows, with count `0`, never hidden → AC-5
- [ ] Visit `/` with 9+ approved products across approved companies → "Featured Products" shows exactly 8, most recently created first, each card links to a working `/products/[slug]` page → AC-6
- [ ] Visit `/` with fewer than 8 approved products → the section shows exactly that many cards, no padding/placeholder cards → AC-6
- [ ] Visit `/` with 7+ approved companies → "Featured Exporters" shows exactly 6, most recently created first → AC-7
- [ ] A featured exporter with no `logo_url` shows an initials avatar (first letter, `--green-wash` background, green text), never a broken image → AC-7, AC-10
- [ ] A featured exporter with no `location` shows its `country` instead → AC-7
- [ ] A featured exporter with `verified = true` shows the Verified badge → AC-7
- [ ] Visit `/` with zero public `buy_requirements` rows → "Latest Buy Requirements" (heading included) does not render anywhere on the page → AC-8
- [ ] Post a public buy requirement, then reload `/` → it appears in "Latest Buy Requirements" with an absolute date (e.g. "Sep 3, 2026"), never a relative string like "2 days ago" → AC-8
- [ ] Inspect the network response for the buy-requirements query (or the RSC payload) → it never contains `contact_name`, `contact_email`, or `buyer_id` → AC-8
- [ ] Visit `/` and read the stats strip (Verified Exporters, Products, Global Buyers, Countries) → each shows a real, plain, locale-formatted integer from `directory_stats`, no `+` suffix, and a genuine zero renders as `0` → AC-9
- [ ] Force `getFeaturedProducts` to error (e.g. point it at a nonexistent column temporarily) → the rest of the home page still renders, only the Featured Products section is missing, no page-level error → AC-11
- [ ] Repeat the forced-error check for `getCategoriesWithProductCounts`, `getFeaturedExporters`, `getLatestBuyRequirements`, and `getDirectoryStats` individually → each section independently disappears without breaking the rest of the page → AC-11
- [ ] Create two products with the same (or colliding) `created_at` → the Featured Products order is stable and identical across repeated reloads (the `id asc` tie-break) → AC-6
- [ ] Resize to a mobile viewport → the new sections (category grid, product cards, exporter cards, buy requirement cards) reflow to a single/2-column layout without overflow → AC-4 (still applies to new sections)

## Commands

- [ ] `npx tsc --noEmit` → no errors
- [ ] `npm run lint` → no errors
- [ ] `npm run build` → succeeds; the `Route (app)` table shows `/` marked `ƒ` (dynamic), not `○` (static) → confirms AC-9's real-time counts can't be frozen by a build-time prerender

## Acceptance-criteria coverage

- AC-1 … pre-existing, unchanged by this pass
- AC-2 … pre-existing hero/chip row, stats strip now real per AC-9
- AC-3 … visual spot-check, no new hardcoded hex values in the new components
- AC-4 … mobile reflow check above
- AC-5 … category grid checks above
- AC-6 … Featured Products checks above
- AC-7 … Featured Exporters checks above
- AC-8 … Latest Buy Requirements checks above (presence, absence, PII, date format)
- AC-9 … stats strip check above
- AC-10 … initials avatar check above
- AC-11 … forced-error checks above, one per query helper

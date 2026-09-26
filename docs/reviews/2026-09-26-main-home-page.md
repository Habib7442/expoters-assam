# Review, main, 2026-09-26

**Reviewed by**: Claude Fable 5.1 (author on another model)
**Scope**: 12 files, feature review at HEAD (scope feature 7, home page, spec 0002) plus uncommitted changes to `lib/supabase/queries/home.ts`, the spec 0002 `index.md` and `verify.md`, and 2 new test files
**Verdict**: Approve with nits
**Follow up (2026-09-26)**: 5 of the 6 minor findings were fixed after review (marked **Resolved** below). The limit caps stay open until there is enough live data.

## Summary

The home page renders a hero with a working scoped search, a category grid with live counts, Featured Products, Featured Exporters and Latest Buy Requirements. Each section comes from its own anon client helper in `lib/supabase/queries/home.ts`, which logs and returns `null` on error so the page drops only that section. Today's uncommitted change deletes `getDirectoryStats` (AC-9 dropped), moves the R2 image filter into the Featured Products query so the limit of 8 counts only showable products, and adds 38 tests covering every helper and the page's section by section failure handling. The public visibility rules hold: every read path filters `status = approved` on top of RLS, and buy requirement contact details are blocked both by the explicit column list and by the column grant in `20260910020000`. Nothing blocks merge. The findings are about consistency: the category counts no longer follow the same rule as the product lists they link to, the spec still describes things that no longer exist, a failure fallback shows invented category names, and the header uses raw palette colors instead of tokens.

## Minor

### 🟡 Category counts no longer match the products they link to, `lib/supabase/queries/home.ts:32`
**Problem**: The tile count comes from `category_product_counts`, which counts approved products of approved companies. Today's AC-6 amendment makes Featured Products also require `companies.verified = true` and an R2 image, and `getProducts` (the `/products?category=` page each tile links to) already filters on `verified` in the query and drops non R2 images after the fetch. AC-5 still says its count is "the same invariant as AC-6", which is no longer true.
**Why it matters**: A tile can say "5 products" and the page it opens can list 3. Today `verified` is set in the same write as approval, so the practical gap is only products with a stale non R2 image. But the spec now contradicts itself, and the two rules will drift further the day an admin can approve a company without verifying it.
**Suggested fix**: Decide which rule is the real one. Either add `c.verified` (and, if wanted, the image host condition) to the view in a new migration, or amend AC-5 to say the count deliberately includes approved but unverified companies and accept the mismatch. At minimum, remove "the same invariant as AC-6" from AC-5.
**Resolved**: migration `20260926010000_category_counts_match_listing.sql` adds `c.verified` to the view's company join, so tile counts match `/products?category=`. Applied live 2026-09-26; the home page tiles still read Agriculture Products 5, others 0, matching the listing. The R2 image part is left out on purpose: no live row has a non R2 image, and the view cannot know the image domain.

### 🟡 A categories failure shows invented category names, `app/page.tsx:20` and `app/page.tsx:73`
**Problem**: When `getCategoriesWithProductCounts` returns `null` or an empty list, the chip row falls back to `FALLBACK_CATEGORY_CHIPS` ("Agarwood Inoculation", "Live Plants", "Handicrafts" and so on). None of these come from the database, and several are not real categories. The chips are also plain `Badge` elements, not links, while the grid tiles below are links.
**Why it matters**: AC-11 says a failed section is omitted, and the rest of the page follows a "never show padded or placeholder content" rule (AC-6, AC-7, AC-8). This is the one place where a database outage renders made up content that looks real. The chips also look like filters but do nothing when clicked, which is confusing next to the clickable grid.
**Suggested fix**: Hide the chip row when categories fail to load, the same way the grid is hidden. If the chips should stay, make each one a link to `/products?category=<slug>` so they match the tiles.
**Resolved**: the fallback chip names are gone. When categories fail, the chip row is omitted like every other section, and each chip now links to `/products?category=<slug>`. Covered by `app/page.test.ts`.

### 🟡 Posted date depends on the server's time zone, `components/buy-requirement-card.tsx:17`
**Problem**: `toLocaleDateString("en-US", {...})` has no `timeZone`, so the date shown is whatever day it is in the server's zone. On Vercel that is UTC, locally it is the developer's zone.
**Why it matters**: A buyer in India who posts at 01:00 IST on Sep 26 sees "Posted Sep 25". The same row can also render a different date in dev and in production, which makes AC-8 verification unreliable near midnight. The company page already fixed the same issue by using the UTC year.
**Suggested fix**: Pass an explicit `timeZone` (either `"UTC"` for consistency with the rest of the site, or `"Asia/Kolkata"` since the audience is Assam based). Add a test with a timestamp near midnight so the choice is pinned.
**Resolved**: `BuyRequirementCard` formats with `timeZone: "Asia/Kolkata"`, with a test for a requirement posted at 00:30 IST.

### 🟡 Spec 0002 still describes things that are gone, `docs/specs/0002-home-page-navbar-hero/index.md:19`
**Problem**: Today's amendment updated AC-2, AC-6 and AC-9 but left three stale statements. AC-1 says every page's header shows "the search bar (scope dropdown + button, non functional)"; the header has no search bar anymore, and the search now lives in the hero and works (`components/hero-search.tsx`). Build step 1 (line 95) still lists `getDirectoryStats()`, and step 3 still says "five queries" placed before "the existing Why ExportsAssam band", which no longer exists. `lib/store/use-search-store.ts`, which AGENTS.md describes as the header search bar's store, is now imported by nothing.
**Why it matters**: The next `/check verify` runs AC-1 as written and will either fail it or quietly skip it. Anyone reading the spec to understand the page gets the wrong picture, and AGENTS.md points at a store that is dead code.
**Suggested fix**: Amend AC-1 to describe the current header and the functional hero search, note the removed helper in the build steps, and either delete `use-search-store.ts` or leave a note in AGENTS.md (via `/sync`) that it is unused.
**Resolved**: AC-1 amended (the header search is gone, search lives in the hero). `lib/store/use-search-store.ts` is left in place because AGENTS.md names it; flag for `/sync`.

### 🟡 Header uses raw palette colors instead of tokens, `components/site-header.tsx:47`
**Problem**: The mobile menu items use `emerald-500`, `teal-700`, `amber-50`, `yellow-500` and similar Tailwind palette classes (lines 47 to 76), plus `bg-white` and `text-white` (lines 178, 275, 279, 288, 324, 333, 342), and `dark:` variants for a dark mode the rest of the page does not have.
**Why it matters**: AC-3 and AGENTS.md require colors to come from the tokens in `app/globals.css`. These are not hex values, so they slip past the letter of the rule, but they bypass the theme the same way. A token change (brand green, dark mode) will leave the mobile menu out of step with everything else.
**Suggested fix**: Map these to existing tokens (`green`, `green-wash`, `gold`, `leaf`, `background`, `primary-foreground`). If the design genuinely needs a distinct accent per menu item, add named tokens for them in `globals.css` rather than using the raw palette.
**Resolved**: every emerald, teal, amber, yellow, white and `dark:` class in `site-header.tsx` is now a token (`green`, `green-deep`, `gold`, `leaf`, `background`, `primary-foreground`). Dark mode is never enabled on this site, so the dropped `dark:` variants never applied.

### 🟡 The new in-query image filter is only checked by argument, and the AC-6 and AC-7 limit checks are still open, `lib/supabase/queries/home.ts:77`
**Problem**: The test for the new `.like("image_url", ...)` line asserts that `like` was called with the right string on a mocked builder. That proves the call, not that PostgREST applies it before the limit. `verify.md` still has three unchecked items that would prove it live: 9 or more products shows exactly 8, 7 or more companies shows exactly 6, and a stable order on a `created_at` tie.
**Why it matters**: The whole reason for moving the filter into the query is so the limit counts only showable products. With 5 products in production nothing exercises that yet, and a mistake in the pattern (for example, a trailing slash difference in the stored URLs) would silently empty the section instead of erroring.
**Suggested fix**: Close the three open verify items with seeded data in the next `/check verify`, including one product with a non R2 image among the newest 9 so the test shows it is skipped and the section still shows 8.
**Open**: the live database has too few rows (5 products, 2 companies) to prove the caps. Worth checking once real suppliers are listed.

## Nits

- ⚪ `lib/supabase/queries/home.ts:77`, `R2_PUBLIC_DOMAIN` goes into the LIKE pattern unescaped, so a `_` in the domain would act as a wildcard. Harmless for the current domain; `containsPattern`'s escaping logic could be reused if the domain ever changes.
- ⚪ `lib/supabase/queries/home.test.ts:9`, `isR2Url` is mocked with a reimplementation, so the "drops a non R2 image" cases test the mock, not the real guard. Same point as the company pages review.
- ⚪ `app/page.test.ts:100`, the stats strip absence test only checks two label strings. It passes because "Verified Businesses" happens not to equal "Verified Exporters"; a test on the absence of the `directory_stats` call or a stats container would be sturdier.
- ⚪ `components/site-footer.tsx:85`, `new Date().getFullYear()` freezes at build time on any statically rendered page that uses the root layout, so the copyright year can be stale until the next deploy. The `/about`, `/contact` and `/faq` 404s are already scope feature 20.
- ⚪ `components/category-tile.tsx:21` and `components/exporter-card.tsx:31`, `name.slice(0, 1)` splits a surrogate pair for a name that starts with an emoji or some non Latin scripts. `Array.from(name)[0]` avoids it.
- ⚪ `components/buy-requirement-card.tsx:24`, the whole card has hover styles (`group-hover`, border change) but only the small "Post similar requirement" link is clickable, so the card looks clickable when it is not.

## Strengths

- The PII boundary for buy requirements is enforced twice: `getLatestBuyRequirements` selects only public columns, and the column grant in `20260910020000` means even a direct REST call with the anon key cannot read `contact_name`, `contact_email` or `buyer_id`. The test asserts the exact column string.
- Moving the image filter into the query is the right fix for the limit problem, and keeping the `isR2Url` post filter as a second guard means a bad row still never reaches `next/image` (which would throw at render). The category counts come from a grouped view, so they cannot be truncated by PostgREST's `max_rows`.
- The new page test renders the real `Home` server component with each helper returning `null` in turn and checks that only that section disappears. That is a genuine test of AC-11 rather than of the mocks, and it replaces a manual forced error check that verify could not safely do.
- Dropping AC-9 was handled cleanly: the helper is deleted rather than left unused, the spec keeps the original criterion for history, and `verify.md` strikes the item instead of silently removing it.

## Test coverage

`home.test.ts` covers every helper: filters, ordering with the id tie break, limits, the R2 filter in and after the query, the location to country fallback, the logo fallback, the escaped search pattern, and the null on error contract. `page.test.ts` covers section rendering, per section failure, the empty buy requirements case, card links, category counts including zero, and the absolute date. Not covered: the posted date near a day boundary (see the time zone finding), the fallback chips being invented content (the test currently asserts that behavior), and the live limit and tie break behavior of the Featured Products and Featured Exporters queries, which only `/check verify` against seeded data can prove. Both files pass (38 tests, run during this review).

# Review, main, 2026-09-26

**Reviewed by**: Claude Fable 5.1 (author on another model)
**Scope**: 8 files, uncommitted (scope feature 6, listings, categories and country filters, no spec, decided inline)
**Verdict**: Approve with nits
**Follow up (2026-09-26)**: minors 1 to 4 fixed after review: countries are normalized on save (`canonicalCountryName`, a case insensitive match to the known list), `/products` lists countries from verified suppliers only and `/companies` hides categories with no products (unless already picked), both pages build their empty message from every active filter (the fallback headings name the country too), and both pages now have tests. Nits fixed: the Badge renders as the link, and the nav labels read "Filter by …". Left open: minor 5 (a grouped view for countries past 1000 companies, needs a migration), and marking an unknown country active.

## Summary

The change adds a `country` URL filter to `/products` and `/companies`, a `category` filter to `/companies` (a company qualifies when it has at least one approved product in that category), and a shared `FilterChips` component that keeps the other filters in every chip link. The public visibility rules hold: the new company category filter reads through the anon client, so the products RLS policy (`status = 'approved'`) already hides pending and rejected products inside the embed, and the query adds `products.status = approved` on top. PostgREST returns embedded rows as a JSON array on the parent, so a company with several matching products still comes back once. Nothing blocks merge. The findings are about the filter values themselves (country is free text, and the chip lists are wider than what each page can show), empty state wording that drops the country on `/products`, and page level logic that has no test.

## Minor

### 🟡 Country is free text, so the chips and the filter are case and spelling sensitive, `lib/supabase/queries/companies.ts:138`
**Problem**: `companies.country` comes from a free text input in the listing form (`lib/actions/business-listing.ts:36` only trims and checks length). `getCompanyCountries` dedupes with an exact match `Set`, and both queries filter with an exact `eq`. A supplier who types "india", "INDIA" or "India " before trim changes nothing, but "india" or "Bharat" becomes its own chip, and picking "India" hides those companies.
**Why it matters**: Today every live row says "India", so nothing is visible yet. Once real suppliers sign up, the country row fragments into near duplicate chips and the filter silently misses companies. The row's own gating (show once there are 2 countries) will also switch on because of a spelling variant rather than a real second country.
**Suggested fix**: Normalize at the source rather than in the filter. Either make the listing form a select from the list already in `lib/country-codes.ts`, or normalize case on write in the action. Admins approving a listing can also correct it, but that is a manual safeguard, not a rule.

### 🟡 Chip lists offer choices the page can never satisfy, `app/products/page.tsx:106` and `app/companies/page.tsx:62`
**Problem**: The country list is every approved company's country, but `/products` only shows products of approved and verified companies with an approved product and an R2 image, so a country can be offered on `/products` that only has companies without listable products. On `/companies`, the category row lists every category from `getCategoriesWithProductCounts`, including ones with a count of 0 (the Tea case in the live check), and those counts are of verified companies' products while the companies page deliberately includes unverified companies.
**Why it matters**: A visitor clicks a chip and lands on an empty state. It is handled cleanly, but a filter row that leads to dead ends reads as a broken directory, and it gets worse as more categories are added ahead of suppliers.
**Suggested fix**: On `/companies`, drop categories whose `productCount` is 0 (the count is already fetched). For countries, accept the small mismatch for now or derive the list from the same rule each page uses; note the choice in the function comment either way.

### 🟡 `/products` empty state drops the country when a category or search is also set, `app/products/page.tsx:126`
**Problem**: The message picks one phrase by precedence (category and q, then q, then category, then country). With `?category=tea&country=Bhutan` it says "No products in Tea yet." even when Tea has products from India. The relaxed sections are also now scoped by country (line 68) but their headings say "Matching X in all categories" and "All products in Tea" with no mention of the country. `/companies` builds a combined summary that includes every active filter, so the two pages now describe the same situation differently.
**Why it matters**: The message tells the visitor something false about the directory, and it may push them to clear the category when the country is the filter that emptied the page.
**Suggested fix**: Reuse the `/companies` approach (a summary built from every active filter) on `/products`, and add "from {country}" to the two relaxed headings when a country is set.

### 🟡 Page level filter logic has no test, `app/companies/page.tsx:39`
**Problem**: The query helpers and `FilterChips` are tested, but nothing renders either page. The branching that lives only in the pages is uncovered: the country row gating (`countries.length > 1 || country`), the combined empty state summary and its "Clear filters" button on `/companies`, the country branch of the `/products` empty message, the country being carried into the relaxed lookups, and both retry links now including every filter.
**Why it matters**: These are the parts a visitor sees, and the empty state wording issue above is exactly the kind of thing a page test would have caught. The home page already has a page test that renders the real server component with mocked helpers, so the pattern exists.
**Suggested fix**: Add `app/products/page.test.ts` and `app/companies/page.test.ts` in the same style as `app/page.test.ts`: one country hides the row, one country picked shows it, each empty state message, and the retry href with all three params.

### 🟡 `getCompanyCountries` reads every approved company on every listing load, `lib/supabase/queries/companies.ts:132`
**Problem**: Both pages are `force-dynamic`, so each request pulls the `country` column of every approved company and dedupes in Node. Above 1000 approved companies PostgREST `max_rows` truncates the list silently, and a country that only appears in later rows disappears from the chips. The comment names the limit, which is good.
**Why it matters**: Not urgent at 2 companies, but the failure is silent (no error, just a missing chip), and the fix is small.
**Suggested fix**: When convenient, a `distinct country` view (or an RPC) returns the finished list, cannot be truncated in practice, and moves the dedupe into Postgres. The home page's category counts already use a grouped view for the same reason.

## Nits

- ⚪ `components/filter-chips.tsx:29`, the `Link` wraps a `Badge` span, so the badge's `focus-visible` ring and `[a]:hover` styles never apply (the selectors target the span, not an anchor). Keyboard focus falls back to the browser default outline. Passing `render={<Link href=... />}` to `Badge` makes the chip itself the anchor and fixes both. Carried over from the old products chip row.
- ⚪ `components/filter-chips.tsx:29`, when the URL carries a value that is not in the options (the `country=Bhutan` case), neither "All" nor any chip is marked active. Harmless, but the row then looks unfiltered while the results are filtered.
- ⚪ `components/filter-chips.tsx:27`, two `nav` landmarks labelled just "Category" and "Country" are a little vague in a screen reader's landmark list; "Filter by category" and "Filter by country" say what they are.
- ⚪ `lib/supabase/queries/companies.ts:97`, the category branch selects the `products` embed and then throws it away in the mapper. It is needed for the `!inner` filter, but selecting only `products!inner(categories!inner(slug))` columns you need (or a comment that the payload is discarded) keeps the response small for companies with many products.
- ⚪ `lib/supabase/queries/companies.ts:78`, the doc comment uses a spaced dash as punctuation in "category and country — the", against the house style used in the reviews and newer comments.

## Strengths

- The category filter on companies is safe by construction: it reads through the anon client, so the products RLS policy hides unapproved products inside the embed even if the explicit `products.status` filter were ever removed, and the parent level `status = approved` still applies. No new `supabaseAdmin` read path was added.
- `FilterChips` builds every link with `URLSearchParams`, so search text like "green & black" and any country or slug value are encoded correctly, and the test asserts the exact encoded hrefs. This also fixes the old products chip row, which interpolated `c.slug` into the URL unencoded.
- Retry links on both pages now carry every active filter, so a failed load retries the same view instead of silently dropping the category or country.
- No raw palette colors or hex values in the changed UI; everything uses tokens and existing shadcn components.

## Test coverage

`companies.test.ts` covers the country filter, the inner join on approved products for the category filter, the absence of the join without a category, the dedupe and sort in `getCompanyCountries`, and its null on error. `products.test.ts` covers the country filter alongside category and search, and its absence. `filter-chips.test.ts` covers link building with other params, the "All" link, `aria-current`, and the bare path case. All 39 tests in these three files pass (run during this review). The mocked builder proves the calls, not PostgREST's behavior; the live checks the author ran (category with and without matches, known and unknown country) cover that. Not covered: everything in the two page components (see the finding above), and a null or empty `country` value in `getCompanyCountries` (the column is `not null`, so only an empty string could reach the filter).

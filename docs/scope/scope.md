# Scope: ExportsAssam.com

A B2B trade directory and enquiry platform connecting Assam/Indian exporters with buyers, in the style of IndiaMART. Every buyer action routes to WhatsApp; the only on-site payment is supplier membership via Razorpay.

**Build approach:** Tracer Bullet (prove the whole pipe works end to end, through every layer, before building any part fully; every slice is real and shippable, just narrow).
**Workflow:** GA (after `/develop`: `/check verify`, `/test`, a fresh model `/check review`, then `/document`; most features get a spec first). This project handles auth, Razorpay payments, and buyer PII, which is exactly the signal that calls for GA.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

**Out of scope for this scope file:** the admin dashboard lives in a completely separate app (`E:\Web Dev\expoters-assam-admin`, its own repo, its own `AGENTS.md`) and is planned there, not here.

## At a glance

| # | Feature | Phase | Status |
|---|---|---|---|
| 1 | Stack, tooling, auth & Supabase connection | Foundation | existing |
| 2 | Database schema & access model | Foundation | done |
| 3 | Design system tokens | Foundation | done |
| 4 | Product page & Send Enquiry (core loop) | Skeleton | done |
| 5 | Company profile pages | Slice 2 | done |
| 6 | Listings, categories & country filters | Slice 2 | done |
| 7 | Home page | Slice 2 | done |
| 8 | Post Buy Requirement | Slice 3 | done |
| 9 | Enquiries on companies & buy requirements | Slice 3 | in-progress |
| 10 | Supplier business listing | Slice 3 | done |
| 11 | Membership plans & Razorpay | Slice 4 | planned · deferred |
| 12 | AI-powered / semantic search | Slice 5 | planned |
| 13 | SEO & GEO | Slice 5 | planned |
| 14 | PostHog analytics | Slice 5 | planned · deferred |
| 15 | Cloudflare R2 image storage | Infrastructure | in-progress |
| 16 | Supplier product submission | Slice 3 | done |
| 17 | Form abuse protection | Infrastructure | done |
| 18 | Legal pages & DPDP compliance | Infrastructure | done |
| 19 | Go live configuration | Infrastructure | planned |
| 20 | About, Contact & FAQ pages | Infrastructure | done |

## Foundations

### 1. Stack, tooling, auth & Supabase connection · existing
Next.js (App Router, TypeScript, Tailwind, shadcn/ui) scaffolded; Clerk wired for authentication (`ClerkProvider`, `proxy.ts` middleware, sign in/up routes); Supabase project linked with a public client and a privileged server-only client. Predates this scope pass, verified working (typecheck, lint, and the dev server all clean).
code in `./` (`proxy.ts`, `app/layout.tsx`, `lib/supabase/`)

### 2. Database schema & access model · done
The core tables from `AGENTS.md` Section 7 (companies, products, categories, buy_requirements, enquiries, memberships, buyers), plus the access model given Clerk, not Supabase Auth, manages sessions.
**Done when:** every table exists with its required columns and constraints (a product needs a name, category, and image before it can be approved), RLS is enabled on every table, and the access model (server-route-mediated writes vs. per-user RLS policies) is decided and applied.
- [x] Design it (spec): `/architect database schema & access model`
- [x] Build it: `/develop database schema & access model`
   - [x] Schema & constraints: all 7 tables, the two derived views, every CHECK/trigger/index (AC-1, AC-3, AC-4, AC-5, AC-6, AC-8, AC-9)
   - [x] RLS, grants & storage: RLS policies, the explicit anon/authenticated revoke, the two Storage buckets (AC-2)
   - [x] Query helpers: `assertOwnsCompany`, `getCurrentTier`/`getCurrentTiersFor`, `getOrCreateBuyerByPhone` in both apps (AC-4, AC-7, security model)
   - [x] Apply & generate types: `supabase db push`, generate and copy `database.types.ts` to both apps (AC-1)
- [x] Verify it: `/check verify database schema & access model`
- [x] Test it: `/test database schema & access model`
- [x] Review it (fresh model): `/check review database schema & access model`
- [x] Document it: `/document database schema & access model`
spec [0001](../specs/0001-database-schema-access-model/index.md) · code in `supabase/migrations/`, `lib/supabase/`, `lib/auth/` (both apps)

### 3. Design system tokens · done
Apply `DESIGN.md`'s locked color, type, and spacing tokens into the Tailwind/shadcn theme so every later screen matches it by default instead of drifting from it screen by screen.
**Done when:** `globals.css` theme tokens match `DESIGN.md` exactly (background, greens, the small gold accent, headings/body fonts), and a sample card and button visibly reflect them.
- [x] Build it: `/develop design system tokens`
code in `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `.claude/skills/develop/design.md`

## Skeleton: core loop

### 4. Product page & Send Enquiry (core loop) · done
The walking skeleton: a buyer opens one real product and sends an enquiry that writes to Supabase, then continues the conversation on WhatsApp themselves via a pre-filled `wa.me` link (no WhatsApp API, no credentials, no external approval). Real auth, real schema, real UI, deliberately narrow, proves the whole pipe end to end before anything else is built.
**Done when:** a buyer can open a product page backed by real Supabase data and send an enquiry; it lands in `enquiries` and the buyer is handed a working WhatsApp link to the supplier.
- [x] Design it (spec): `/architect product page & send enquiry`
- [x] Build it: `/develop product page & send enquiry`
   - [x] Data layer: `company_contacts` table, `products.slug`, the `create_enquiry` function, migration applied and types regenerated in both apps (AC-5, AC-6, AC-7, AC-8)
   - [x] Query helpers + demo seed data so the page has something real to render (AC-1, AC-7, AC-8)
   - [x] Product page (`/products/[slug]`), metadata, image config (AC-1)
   - [x] Send Enquiry dialog, form, and the `sendEnquiry` server action with rate limiting, dedup, and the `wa.me` link (AC-2, AC-3, AC-4, AC-5, AC-8)
- [x] Verify it: `/check verify product page & send enquiry`
- [x] Test it: `/test product page & send enquiry`
- [x] Review it (fresh model): `/check review product page & send enquiry`
- [x] Document it: `/document product page & send enquiry`
spec [0003](../specs/0003-product-page-send-enquiry/index.md) · code in `supabase/migrations/20260827080000_add_company_contacts_and_product_slug.sql`, `lib/supabase/queries/products.ts`, `lib/actions/send-enquiry.ts`, `app/products/[slug]/`, `components/send-enquiry-dialog.tsx`, `scripts/seed-demo.ts`

## Slice 2: browse the directory

### 5. Company profile pages · done
Each supplier's profile page: logo, about, location, product range, verified badge, and membership tier badge (reusing the product page's `getCurrentTier` pattern). Routed by a new `companies.slug` column, mirroring `products.slug` (spec 0003): nullable-add, backfilled, then `not null unique`, since companies already had rows when this was added (unlike products). `create_business_listing` now assigns a slug at insert time (slugified name, deduplicated with a numeric suffix on collision); a rename never changes the slug. Decided and built inline with the engineer, no separate spec: a direct extension of an already-established pattern, not a new product decision.
**Done when:** a company page renders real Supabase data, including the products it lists.
- [x] Design it (spec): decided inline (see note above), no `docs/specs/` entry
- [x] Build it: `/develop company profile pages`
   - [x] Migration: `companies.slug` (nullable, backfilled, then `not null unique`), `slugify()` helper, `create_business_listing` assigns a slug at insert
   - [x] Data layer: `getCompanyBySlug` in `lib/supabase/queries/companies.ts`, sanitizing `logo_url`/product `image_url` through the same `isR2Url` guard as the product page and home page
   - [x] `/companies/[slug]` page; `ExporterCard` (home page) and the product page's company block now link to it
- [x] Verify it: `/check verify company profile pages`
- [x] Test it: `/test company profile pages`
- [x] Review it (fresh model): `/check review company profile pages`
- [x] Document it: `/document company profile pages`
code in `supabase/migrations/20260909033000_add_company_slug.sql`, `lib/supabase/queries/companies.ts`, `app/companies/[slug]/page.tsx`, `components/exporter-card.tsx`, `app/products/[slug]/page.tsx`, `lib/supabase/queries/home.ts`, `lib/supabase/queries/products.ts`, `scripts/seed-demo.ts`

### 6. Listings, categories & country filters · done
Browse products or companies by category, or by supplier location/country.
Partly shipped without a spec: `/products` filters by category and a name search (both in the URL), and `/companies` and `/buy-requirements` have a name search. Still missing: any country/location filter, and a category filter on `/companies`. Companies now store state and country (migration `20260911060000`), so the remaining decision may be small enough to settle inline rather than in a full spec.
**Done when:** a visitor can filter the product or company list by category and by country, and the URL reflects the active filter.
- [x] Design it (spec): decided inline 2026-09-26, no `docs/specs/` entry: a `country` URL param on `/products` (the supplier's country) and `/companies`, a `category` param on `/companies` (has at least one approved product in it), chips shared via `FilterChips`, the country row shown only once two countries exist, countries normalized on save
- [x] Build it: `/develop listings, categories & country filters`
- [x] Verify it: live against the real data (category on companies returns only the company with products in it; country India and Bhutan; empty states and chip rows)
- [x] Test it: query filters, both pages, chips, country normalization
- [x] Review it (fresh model): approve with nits, fixes applied (`docs/reviews/2026-09-26-main-listing-filters.md`)
code in `app/products/page.tsx`, `app/companies/page.tsx`, `components/filter-chips.tsx`, `lib/supabase/queries/products.ts`, `lib/supabase/queries/companies.ts`, `lib/country-codes.ts`, `lib/actions/business-listing.ts`

### 7. Home page · done
Hero with search bar, quick stats (verified exporters, products, buyers, countries connected), featured products/exporters, latest buy requirements, and entry actions ("List Your Business Free", "Post Buy Requirement").
**Done when:** the home page shows real featured content pulled from Supabase, not placeholders. The stats strip (AC-9) was dropped on 2026-09-26 by the engineer; see spec 0002.
- [x] Design it (spec): `/architect home page`
- [x] Build it: `/develop home page`
   - [x] Navbar (top bar + sticky header) and hero section, static/placeholder data (AC-1, AC-2, AC-3, AC-4)
   - [x] Why ExportsAssam value-props band (Global Reach, Verified Businesses, Trusted Connections, Grow Your Business)
   - [x] Signup CTA band and site-wide footer (no newsletter email capture built — not in the PRD's data model, would be an unbuilt/unwired feature; the band reuses the existing "List Your Business Free" signup action instead)
   - [x] Data layer: `lib/supabase/queries/home.ts` query helpers, each owning its own failure handling (AC-5, AC-6, AC-7, AC-8, AC-9, AC-11)
   - [x] Category tile, product card, exporter card, buy requirement card components (AC-5, AC-6, AC-7, AC-8, AC-10)
   - [x] Wire category grid, featured products, featured exporters, latest buy requirements into `app/page.tsx`, parallel fetched, each section omitted on its own failure (AC-5, AC-6, AC-7, AC-8, AC-11)
   - [x] Real stats strip numbers from `directory_stats` (AC-9) — strip markup didn't exist yet, built it as part of this task
- [x] Verify it: `/check verify home page` (2026-09-26: AC-9 dropped by the engineer; AC-11 proven by tests rather than a live forced error; the 8 and 6 caps untested live, too few rows)
- [x] Test it: `/test home page`
- [x] Review it (fresh model): `/check review home page`
- [x] Document it: `/document home page`
spec [0002](../specs/0002-home-page-navbar-hero/index.md) · code in `app/layout.tsx`, `components/site-header.tsx`, `components/site-footer.tsx`, `app/page.tsx`, `lib/supabase/queries/home.ts`, `components/category-tile.tsx`, `components/product-card.tsx`, `components/exporter-card.tsx`, `components/buy-requirement-card.tsx`

## Slice 3: capture more leads

### 8. Post Buy Requirement · done
A buyer posts what they want to buy (product, quantity, location, notes); it is saved, optionally shown publicly under Latest Buy Requirements, and forwarded to WhatsApp. The "forwarded to WhatsApp" open question (a buy requirement has no single supplier to route a wa.me link to, unlike an enquiry) was decided inline with the engineer: hand the buyer a wa.me link to the platform's own WhatsApp number (`PLATFORM_WHATSAPP_NUMBER`, a placeholder for now per AGENTS.md Section 6 — TBD real number from the client), the same no-API pattern already used for enquiries, not the real WhatsApp API/BSP integration AGENTS.md flags as a separate open decision.
**Done when:** a buyer can submit a requirement, it appears in the public list when marked visible, and the WhatsApp message is received.
- [x] Design it (spec): decided inline (see note above), no `docs/specs/` entry
- [x] Build it: `/develop post buy requirement`
   - [x] `create_buy_requirement` RPC: buyer resolution, a 3/hour rate limit (heavier action than an enquiry, so a lower cap), no dedup (distinct requirements from the same buyer are legitimate)
   - [x] `postBuyRequirement` server action + `BuyRequirementForm`; `/buy-requirements/new` (post) and `/buy-requirements` (full public listing, fixing the two nav links that already pointed here)
- [x] Verify it: `/check verify post buy requirement` (2026-09-26, driven in a real browser with Cloudflare's always pass Turnstile test keys, since the real key rejects localhost: invalid phone keeps the typed values and saves nothing; a public post saves with consent recorded, normalizes the phone, and hands a wa.me link to +919577772757; a private post saves but never lists; the public post shows on `/buy-requirements` and `/` with no name, phone or email; the 4th post in an hour gets the rate limit message; a missing token is refused with a friendly retry; prefill and 390px layout fine. Test rows deleted.)
- [x] Test it: `/test post buy requirement`
- [x] Review it (fresh model): `/check review post buy requirement`
- [x] Document it: `/document post buy requirement`
code in `supabase/migrations/20260909050000_add_create_buy_requirement.sql`, `lib/actions/post-buy-requirement.ts`, `components/buy-requirement-form.tsx`, `app/buy-requirements/new/page.tsx`, `app/buy-requirements/page.tsx`, `.env.local`

### 9. Enquiries on companies & buy requirements · in-progress
Extend the Send Enquiry action already proven in the core loop (feature 4) to company profile pages and buy requirement listings. The company half is built: a new `create_company_enquiry` RPC mirrors `create_enquiry` exactly (buyer resolution, the same global per-buyer rate limit, a 10-minute dedup window scoped to the company, `product_id` left null), and `SendEnquiryDialog`/`sendEnquiry` were generalized to a `target: {type: "product"|"company"}` union rather than duplicated. The buy requirement half needs a decision first (see its box below), not a feature-8 dependency — feature 8 now exists.
**Done when:** Send Enquiry works from a company page and from a buy requirement, using the same write-and-WhatsApp-forward path the core loop already proved.
- [x] Build it (company half): `/develop enquiries on companies`
   - [x] `create_company_enquiry` RPC, mirroring `create_enquiry`'s rate limit/dedup/buyer-resolution shape
   - [x] `sendEnquiry`/`SendEnquiryDialog` generalized to a product/company target union
   - [x] Wired onto `/companies/[slug]`; live-verified via the RPC directly (dedup returns the same `enquiry_id`) and via the running dev server (button renders on both pages)
- [x] Design it (spec): decided 2026-09-26 by the engineer, no `docs/specs/` entry: a supplier's reply to a buy requirement goes to the platform's own WhatsApp number (`PLATFORM_WHATSAPP_NUMBER`) with the requirement reference, and the client's team introduces the two sides. The buyer's phone is never shown to anyone.
- [ ] Build it (buy requirement half): `/develop enquiries on buy requirements`. Original blocker, kept for history: needs a decision, not just a build — feature 8 now exists, but a buy requirement has no public company-style WhatsApp contact to route to; the only recipient is the posting buyer's own phone number, which is private PII (`buyers` has no RLS policy at all, unlike a company's public contact). Handing that number to any anonymous visitor who clicks "enquire," or exposing it via a wa.me link, is a materially different privacy posture than the product/company cases and isn't specified in AGENTS.md/PRD. Route to `/architect` before building: who actually receives this enquiry, and how.
code in `supabase/migrations/20260909040000_add_company_enquiry.sql`, `lib/actions/send-enquiry.ts`, `components/send-enquiry-dialog.tsx`, `app/companies/[slug]/page.tsx`, `app/products/[slug]/page.tsx`

### 10. Supplier business listing · done
A supplier turns their Clerk account into a real, pending business listing: name, location, logo, business email, and a WhatsApp contact number, created together as one atomic step. It stays `pending` until an admin approves it in the separate admin app; a rejected listing shows why and can be edited and resubmitted. (The approval action itself lives in the separate admin app; this feature is only the supplier-facing listing side.) This is the first half of what was originally scoped as supplier self-service submission; submitting products under an approved company is its own follow-on feature (16), deferred until a real approved company exists to design and build against.
**Done when:** a supplier can submit their business listing (name, location, logo, business email, WhatsApp number), it is stored `pending` with its WhatsApp contact created atomically, it never appears on any public read path until approved, and a rejected listing shows the reason and can be fixed and resubmitted.
- [x] Design it (spec): `/architect supplier business listing`
- [x] Build it: `/develop supplier business listing`
   - [x] Schema: widen `companies.status` to allow `rejected`, add `rejection_reason` (AC-5, AC-6, AC-7)
   - [x] Atomic DB functions: `create_business_listing`, `update_business_listing` (AC-2, AC-5, AC-6)
   - [x] Data layer & server actions: `getMyCompany`, `submitBusinessListing`, `updateBusinessListing`, logo upload + storage config (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-10)
   - [x] `/list-business` page and rewiring the "List Your Business Free" CTAs (AC-1, AC-4, AC-5, AC-6, AC-7, AC-11)
- [x] Verify it: `/check verify supplier business listing` (2026-09-26, real signed in browser; AC-6 amended to record the shipped "edit sends it back to review" behavior)
- [x] Test it: `/test supplier business listing`
- [x] Review it (fresh model): `/check review supplier business listing`
- [x] Document it: `/document supplier business listing`
spec [0005](../specs/0005-supplier-business-listing/index.md) · code in `supabase/migrations/20260903120000_add_business_listing.sql`, `supabase/migrations/20260903120500_add_business_listing_rate_limit.sql`, `supabase/migrations/20260903121000_fix_update_business_listing_conflict_target.sql`, `supabase/migrations/20260903130000_add_business_listing_email.sql`, `lib/supabase/queries/companies.ts`, `lib/actions/business-listing.ts`, `app/list-business/page.tsx`, `components/business-listing-form.tsx`

### 16. Supplier product submission · done · from spec 0005
An approved supplier submits their own product (name, category, images) from their own dashboard; it stays `pending` until an admin approves it in the separate admin app. Deferred out of feature 10 (spec 0005's Follow-up) until a real approved company existed to design and build against; that gate has since shipped. Decided and built inline with the engineer, no separate spec: image upload reuses spec 0005's own `{clerkUserId}/{uuid}.{ext}` R2 key convention (already named as this feature's own owed decision in spec 0004's Follow-up), and slug generation reuses `public.slugify()` + the same collision-retry pattern `create_business_listing` already established — both direct extensions of already-decided patterns, not new product decisions.
**Done when:** an approved supplier can submit a product with images, it is stored `pending`, and it does not appear on any public read path until approved.
- [x] Design it (spec): decided inline (see note above), no `docs/specs/` entry
- [x] Build it: `/develop supplier product submission`
   - [x] `create_product_submission` RPC: gates on the caller's company being `approved` (`P0007` otherwise), atomic slug generation with collision retry, `submitted_by = 'supplier'`
   - [x] `submitProduct` server action (`lib/actions/submit-product.ts`): up to 5 images, 2 MB/JPG-PNG-WebP each, uploaded to R2 before the database write
   - [x] `ProductSubmissionForm` (plain `onSubmit`, not `<form action={fn}>` — same fix as the business listing/buy requirement forms, so a validation error doesn't wipe what the user typed) and `/products/new`, gated on the caller's own company status (no company → list business first; pending/rejected → check status; approved → the form)
   - [x] Live-verified directly against the RPC: happy path (real row, correct slug, correct `image_url`/`gallery_urls`), the `pending`-company gate (`P0007`), the no-images guard (`P0008`), the no-company guard (`P0004`), slug collision suffixing, and invisibility on the public anon read path; test rows cleaned up after
- [x] Verify it: `/check verify supplier product submission` (2026-09-26, real signed in browser as an approved supplier: two images uploaded to R2, product `pending` and `submitted_by = supplier`, public page 404 until approved then 200 and listed on the company page; a pending company sees "under review" instead of the form and its approved products go hidden; signed out `/products/new` redirects to sign in. Test data deleted.)
- [x] Test it: `/test supplier product submission`
- [x] Review it (fresh model): `/check review supplier product submission`
- [x] Document it: `/document supplier product submission`
code in `supabase/migrations/20260911010000_add_create_product_submission.sql`, `lib/actions/submit-product.ts`, `components/product-submission-form.tsx`, `app/products/new/page.tsx`

## Slice 4: revenue

### 11. Membership plans & Razorpay · needs a decision
Basic/Silver/Gold tiers; a supplier upgrades and pays via Razorpay; a successful payment auto-upgrades the account (badge, ranking boost, featured placement).
**Deferred by you (2026-09-25):** not the next build; pick it back up later. Silver and Gold prices are still unconfirmed by the client. A static `/membership` plans page already exists; its checkout button is not wired yet (code in `app/membership/page.tsx`).
**Done when:** a supplier can choose Silver or Gold, pay via Razorpay, and their membership tier updates automatically on successful payment, with the payment logged.
- [ ] Design it (spec): `/architect membership plans & razorpay`

## Slice 5: findability

### 12. AI-powered / semantic search · planned
Fast product/company search with spelling tolerance and instant suggestions, built on Supabase semantic matching, not a third party search SaaS.
A basic stand in already works: the header and hero search do a plain name match (`ilike`) on products, companies, and buy requirements. No typo tolerance or semantic matching yet; that is what this feature still owes.
**Done when:** search returns relevant results tolerant of common typos and updates as the user types.
**Decided 2026-09-26 by the engineer:** typo tolerant search via Postgres trigram matching (`pg_trgm`), with suggestions as you type. No embeddings or semantic matching for now; that stays a possible later add on.
- [x] Design it (spec): decided inline (see note above), no `docs/specs/` entry
- [ ] Build it: `/develop ai-powered search`

### 13. SEO & GEO · planned
Sitemap, per-page metadata and structured data, clean URLs, and AI-crawler readiness, per PRD Sections 8 to 9 and the installed `seo-aeo-best-practices` skill.
**Done when:** every product and company page has correct metadata and structured data, a sitemap exists, and crawler access is configured.
- [ ] Build it: `/develop seo & geo`

### 14. PostHog analytics · planned
Page views, search behavior, and enquiry funnel drop-off tracked via PostHog.
**Deferred by you (2026-09-26):** you will implement it yourself later; not part of this handover pass.
**Done when:** key events (page view, search performed, enquiry sent, buy requirement posted) appear in PostHog.
- [ ] Build it: `/develop posthog analytics`

## Infrastructure

### 15. Cloudflare R2 image storage · in-progress
Moves where product and company images live, from the Supabase Storage buckets spec 0001 created to Cloudflare R2, mainly for R2's zero egress cost as the directory's image traffic grows. Enrolled after spec 0001 shipped; the two Supabase buckets stay in place with public read revoked, not deleted.
**Done when:** the demo product's image (feature 4) is served from R2 through a custom domain, `next/image` renders it in both dev and a Vercel production build, and the old Supabase buckets no longer serve public reads.
- [x] Design it (spec): `/architect switch image storage from Supabase Storage to Cloudflare R2`
- [x] Build it: `/develop cloudflare r2 image storage`
   - [x] R2 setup: dedicated domain (`exportersasssm.com`) connected to Cloudflare, bucket (`exportsassam-images`), scoped API token (Object Read & Write, single bucket), custom domain (`images.exportersasssm.com`), env vars in `.env.local` (AC-1)
   - [x] Storage helper: `lib/storage/r2-client.ts` (unguarded core: `createR2Client`, `uploadToR2`, `deleteFromR2`, `parseR2Url`) + `lib/storage/r2.ts` (`server-only` entry), checksum config (AC-1, AC-2, AC-5)
   - [x] Demo seed migrated to R2, `next.config.ts` updated, re-seed verified against the live product page (AC-3, AC-4)
   - [x] Old Supabase buckets' public read revoked; spec 0001's storage section annotated as superseded (AC-6). Caught live: dropping the RLS policy alone didn't work, `storage.buckets.public` also had to be set `false`
   - [x] Migrated the business listing feature's (10) logo upload from Supabase Storage to R2, since revoking the old bucket would otherwise have broken it; not in this spec's original design, decided inline with the engineer
- [x] Verify it: `/check verify cloudflare r2 image storage`
- [x] Test it: `/test cloudflare r2 image storage`
- [x] Review it (fresh model): `/check review cloudflare r2 image storage`
- [ ] Document it: `/document cloudflare r2 image storage`
spec [0004](../specs/0004-cloudflare-r2-image-storage/index.md) · code in `lib/storage/r2-client.ts`, `lib/storage/r2.ts`, `scripts/seed-demo.ts`, `next.config.ts`, `lib/actions/business-listing.ts`, `supabase/migrations/20260903140000_revoke_supabase_storage_public_read.sql`, `supabase/migrations/20260909020000_disable_supabase_storage_public_buckets.sql`

### 17. Form abuse protection · done
An invisible Cloudflare Turnstile bot check on the two anonymous forms (Send Enquiry, Post Buy Requirement), a per company hourly cap on product submission, and uploaded images decoded with sharp to reject files that are not real images. No IP address is stored. Enrolled after the fact from spec 0006 and the security hardening commits.
**Done when:** a missing or rejected Turnstile token blocks the write with a friendly retry, an unreachable Cloudflare fails open and logs, and a supplier past 30 products an hour gets `rate_limited` before any image uploads.
- [x] Design it (spec): `/architect form abuse protection`
- [x] Build it: `/develop form abuse protection`
   - [x] `verifyTurnstile` helper and `TurnstileWidget`, wired into both anonymous forms (AC-1 to AC-4)
   - [x] Per company product cap in `create_product_submission` plus the pre check in `submitProduct` (AC-5, AC-6)
   - [x] Privacy Policy names Cloudflare; image signature check via sharp (AC-7)
- [x] Verify it: `/check verify form abuse protection` (2026-09-26, live: with Cloudflare's always fail secret both anonymous forms refuse with the friendly retry message, save nothing, reset the widget and keep typed values (AC-1, AC-2); with no keys the widget is absent, the post goes through, and the server logs "bot check skipped" (AC-4); 3 concurrent `create_product_submission` calls at 28 products gave ok, P0010, ok and a 4th P0010 (AC-5); a capped supplier in the browser gets the cap message with 0 R2 objects written and nothing saved (AC-6); no IP or bot data column exists and the Privacy Policy names Cloudflare Turnstile (AC-7). AC-3 (Cloudflare unreachable, fail open) is covered by `lib/security/turnstile.test.ts`, not forced live. Test data deleted.)
- [x] Test it: `/test form abuse protection` (unit tests written with the build: `lib/security/turnstile.test.ts`, `lib/image-signature.test.ts`, action mapping tests)
- [x] Review it (fresh model): `/check review form abuse protection`
- [x] Document it: `/document form abuse protection`
spec [0006](../specs/0006-form-abuse-protection.md) · code in `lib/security/turnstile.ts`, `components/turnstile-widget.tsx`, `lib/image-signature.ts`, `lib/actions/send-enquiry.ts`, `lib/actions/post-buy-requirement.ts`, `lib/actions/submit-product.ts`, `supabase/migrations/20260925050000_add_product_submission_rate_limit.sql`

### 18. Legal pages & DPDP compliance · done
Privacy Policy and Terms pages, an explicit consent checkbox on every form that collects personal data (recorded in the database), and a nightly job that deletes buyer personal data past its retention window, so the promises in the Privacy Policy are actually kept. Built inline without a spec; enrolled after the fact.
**Done when:** every form that collects personal data requires and stores consent, the database refuses writes without it, the retention job runs nightly, and the privacy and terms pages accurately describe what suppliers see over WhatsApp.
- [x] Design it (spec): decided inline, no `docs/specs/` entry
- [x] Build it: `/develop legal pages & dpdp compliance`
   - [x] `/privacy` and `/terms` pages, WhatsApp data sharing wording clarified
   - [x] `ConsentCheckbox` on enquiry, buy requirement, and business listing forms; consent recorded by the `create_*` functions, consent less overloads dropped
   - [x] Nightly personal data retention job (pg_cron)
   - [x] Clerk `user.deleted` webhook deletes the supplier's listing, products, contact and images (review 2026-09-26, engineer chose automatic deletion)
- [x] Verify it: `/check verify legal pages & dpdp compliance` (2026-09-26, live: `/privacy` and `/terms` render; all four `create_*` functions return `P0009` on blank consent, have no consent-less overload left (`PGRST202`), refuse the anon role (`42501`), and wrote nothing; the consent box is required on the enquiry, buy requirement and listing forms; `purge-expired-personal-data` is an active pg_cron job at 20:30 UTC daily, last run succeeded. The Privacy Policy described enquiries but not buy requirements; a factual paragraph was added. Retention periods still carry a `TODO(client)`.)
- [x] Test it: `/test legal pages & dpdp compliance` (consent is covered in the enquiry, buy requirement and listing action tests; the SQL consent guard and the cron job were proven live, not unit testable)
- [x] Review it (fresh model): `/check review legal pages & dpdp compliance`
- [x] Document it: `/document legal pages & dpdp compliance`
code in `app/privacy/page.tsx`, `app/terms/page.tsx`, `components/consent-checkbox.tsx`, `supabase/migrations/20260925010000_record_dpdp_consent.sql`, `supabase/migrations/20260925020000_add_personal_data_retention_job.sql`, `supabase/migrations/20260925060000_drop_consentless_create_overloads.sql`

### 19. Go live configuration · planned
The production settings that have piled up as follow ups across specs, collected in one place so nothing is missed at launch: Clerk production instance, real Turnstile keys in Vercel (spec 0006), a Content Security Policy that allows `challenges.cloudflare.com` (spec 0006), the client's real platform WhatsApp number replacing the placeholder (feature 8; done 2026-09-26, `+919577772757` set in `.env.local` and locked, still to be copied into Vercel), and all env vars set in Vercel. The live site is `https://www.exportersasssm.com` (locked 2026-09-26). Domains (`exportersasssm.com` for images) and the contact email `info@exportsassam.com` were confirmed correct and locked by the engineer on 2026-09-26; no change needed. The Turnstile site key rejects `localhost` (error 110200 in the dev log), so the production domain must be on its allowed hostnames list. Also from the 2026-09-26 reviews: add a Clerk webhook endpoint `https://www.exportersasssm.com/api/webhooks/clerk` subscribed to `user.deleted` and put its signing secret in Vercel as `CLERK_WEBHOOK_SIGNING_SECRET` (without it, account deletion leaves the listing up); switch on Clerk's legal consent setting (Privacy Policy and Terms URLs) so sign up records agreement, as the Privacy Policy now says; and get the client to confirm the retention periods in `app/privacy/page.tsx` (marked `TODO(client)`, the 12 months is also in the purge SQL).
**Done when:** a Vercel production build runs against production Clerk, real Turnstile keys, and the real WhatsApp number, with every form working end to end on the live domain.
- [ ] Build it: `/develop go live configuration`

### 20. About, Contact & FAQ pages · done
The footer links to `/about`, `/contact`, and `/faq`, and all three return 404 (found by `/check verify home page`, 2026-09-26). Build them from facts already on record (PRD, the company details in the footer, the enquiry and listing flows), never invented claims; anything only the client can supply (team, history, phone) is left as a clearly marked gap for them to fill.
**Done when:** every footer link resolves to a real page with accurate content.
- [x] Build it: `/develop about, contact & faq pages` (2026-09-26: `/about`, `/contact` (email, WhatsApp from `PLATFORM_WHATSAPP_NUMBER`, company), `/faq` (16 answers written from how the code behaves, with FAQPage JSON-LD); every footer link now resolves; 390px layout checked)
- [x] Test it: FAQ structured data matches the questions shown; Contact follows the configured WhatsApp number and hides it when unset
- [x] Review it: skipped on purpose, static content pages with no data or input; the copy was checked line by line against the code and Privacy Policy
code in `app/about/page.tsx`, `app/contact/page.tsx`, `app/faq/page.tsx`

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Its wording varies, so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | `/architect` at spec capture | `Design it` ticked; spec linked; `Build it: /develop <feature>` + 2 to 5 milestones; the tier's closing boxes (`Verify it`, `Test it`, `Review it`, `Document it` at GA); any surfaced follow-up enrolled |
| `in-progress` (building) | `/develop` | milestone sub-boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | you, when you decide it is (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; at GA, the suggested point to call it done is after `/test`; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop`. The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status**: `planned` → `in-progress` → `done`, plus `existing` (pre-workflow) and `dropped` (de-scoped, kept for history).
- **Workflow tier tag** beside a heading (e.g. `· Alpha`) would set that one feature's rigor above or below the GA default; none currently differ, so none carry a tag.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.

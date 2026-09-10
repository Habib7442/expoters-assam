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
| 4 | Product page & Send Enquiry (core loop) | Skeleton | in-progress |
| 5 | Company profile pages | Slice 2 | planned · needs a decision |
| 6 | Listings, categories & country filters | Slice 2 | planned · needs a decision |
| 7 | Home page | Slice 2 | in-progress |
| 8 | Post Buy Requirement | Slice 3 | planned · needs a decision |
| 9 | Enquiries on companies & buy requirements | Slice 3 | planned |
| 10 | Supplier business listing | Slice 3 | in-progress |
| 11 | Membership plans & Razorpay | Slice 4 | planned · needs a decision |
| 12 | AI-powered / semantic search | Slice 5 | planned · needs a decision |
| 13 | SEO & GEO | Slice 5 | planned |
| 14 | PostHog analytics | Slice 5 | planned |
| 15 | Cloudflare R2 image storage | Infrastructure | in-progress |
| 16 | Supplier product submission | Slice 3 | planned · needs a decision |

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

### 4. Product page & Send Enquiry (core loop) · in-progress
The walking skeleton: a buyer opens one real product and sends an enquiry that writes to Supabase, then continues the conversation on WhatsApp themselves via a pre-filled `wa.me` link (no WhatsApp API, no credentials, no external approval). Real auth, real schema, real UI, deliberately narrow, proves the whole pipe end to end before anything else is built.
**Done when:** a buyer can open a product page backed by real Supabase data and send an enquiry; it lands in `enquiries` and the buyer is handed a working WhatsApp link to the supplier.
- [x] Design it (spec): `/architect product page & send enquiry`
- [x] Build it: `/develop product page & send enquiry`
   - [x] Data layer: `company_contacts` table, `products.slug`, the `create_enquiry` function, migration applied and types regenerated in both apps (AC-5, AC-6, AC-7, AC-8)
   - [x] Query helpers + demo seed data so the page has something real to render (AC-1, AC-7, AC-8)
   - [x] Product page (`/products/[slug]`), metadata, image config (AC-1)
   - [x] Send Enquiry dialog, form, and the `sendEnquiry` server action with rate limiting, dedup, and the `wa.me` link (AC-2, AC-3, AC-4, AC-5, AC-8)
- [ ] Verify it: `/check verify product page & send enquiry`
- [ ] Test it: `/test product page & send enquiry`
- [ ] Review it (fresh model): `/check review product page & send enquiry`
- [ ] Document it: `/document product page & send enquiry`
spec [0003](../specs/0003-product-page-send-enquiry/index.md) · code in `supabase/migrations/20260827080000_add_company_contacts_and_product_slug.sql`, `lib/supabase/queries/products.ts`, `lib/actions/send-enquiry.ts`, `app/products/[slug]/`, `components/send-enquiry-dialog.tsx`, `scripts/seed-demo.ts`

## Slice 2: browse the directory

### 5. Company profile pages · in-progress
Each supplier's profile page: logo, about, location, product range, verified badge, and membership tier badge (reusing the product page's `getCurrentTier` pattern). Routed by a new `companies.slug` column, mirroring `products.slug` (spec 0003): nullable-add, backfilled, then `not null unique`, since companies already had rows when this was added (unlike products). `create_business_listing` now assigns a slug at insert time (slugified name, deduplicated with a numeric suffix on collision); a rename never changes the slug. Decided and built inline with the engineer, no separate spec: a direct extension of an already-established pattern, not a new product decision.
**Done when:** a company page renders real Supabase data, including the products it lists.
- [x] Design it (spec): decided inline (see note above), no `docs/specs/` entry
- [x] Build it: `/develop company profile pages`
   - [x] Migration: `companies.slug` (nullable, backfilled, then `not null unique`), `slugify()` helper, `create_business_listing` assigns a slug at insert
   - [x] Data layer: `getCompanyBySlug` in `lib/supabase/queries/companies.ts`, sanitizing `logo_url`/product `image_url` through the same `isR2Url` guard as the product page and home page
   - [x] `/companies/[slug]` page; `ExporterCard` (home page) and the product page's company block now link to it
- [ ] Verify it: `/check verify company profile pages`
- [ ] Test it: `/test company profile pages`
- [ ] Review it (fresh model): `/check review company profile pages`
- [ ] Document it: `/document company profile pages`
code in `supabase/migrations/20260909033000_add_company_slug.sql`, `lib/supabase/queries/companies.ts`, `app/companies/[slug]/page.tsx`, `components/exporter-card.tsx`, `app/products/[slug]/page.tsx`, `lib/supabase/queries/home.ts`, `lib/supabase/queries/products.ts`, `scripts/seed-demo.ts`

### 6. Listings, categories & country filters · needs a decision
Browse products or companies by category, or by supplier location/country.
**Done when:** a visitor can filter the product or company list by category and by country, and the URL reflects the active filter.
- [ ] Design it (spec): `/architect listings, categories & country filters`

### 7. Home page · in-progress
Hero with search bar, quick stats (verified exporters, products, buyers, countries connected), featured products/exporters, latest buy requirements, and entry actions ("List Your Business Free", "Post Buy Requirement").
**Done when:** the home page shows real counts and real featured content pulled from Supabase, not placeholders.
- [x] Design it (spec): `/architect home page`
- [x] Build it: `/develop home page`
   - [x] Navbar (top bar + sticky header) and hero section, static/placeholder data (AC-1, AC-2, AC-3, AC-4)
   - [x] Why ExportsAssam value-props band (Global Reach, Verified Businesses, Trusted Connections, Grow Your Business)
   - [x] Signup CTA band and site-wide footer (no newsletter email capture built — not in the PRD's data model, would be an unbuilt/unwired feature; the band reuses the existing "List Your Business Free" signup action instead)
   - [x] Data layer: `lib/supabase/queries/home.ts` query helpers, each owning its own failure handling (AC-5, AC-6, AC-7, AC-8, AC-9, AC-11)
   - [x] Category tile, product card, exporter card, buy requirement card components (AC-5, AC-6, AC-7, AC-8, AC-10)
   - [x] Wire category grid, featured products, featured exporters, latest buy requirements into `app/page.tsx`, parallel fetched, each section omitted on its own failure (AC-5, AC-6, AC-7, AC-8, AC-11)
   - [x] Real stats strip numbers from `directory_stats` (AC-9) — strip markup didn't exist yet, built it as part of this task
- [ ] Verify it: `/check verify home page`
- [ ] Test it: `/test home page`
- [ ] Review it (fresh model): `/check review home page`
- [ ] Document it: `/document home page`
spec [0002](../specs/0002-home-page-navbar-hero/index.md) · code in `app/layout.tsx`, `components/site-header.tsx`, `components/site-footer.tsx`, `app/page.tsx`, `lib/supabase/queries/home.ts`, `components/category-tile.tsx`, `components/product-card.tsx`, `components/exporter-card.tsx`, `components/buy-requirement-card.tsx`

## Slice 3: capture more leads

### 8. Post Buy Requirement · in-progress
A buyer posts what they want to buy (product, quantity, location, notes); it is saved, optionally shown publicly under Latest Buy Requirements, and forwarded to WhatsApp. The "forwarded to WhatsApp" open question (a buy requirement has no single supplier to route a wa.me link to, unlike an enquiry) was decided inline with the engineer: hand the buyer a wa.me link to the platform's own WhatsApp number (`PLATFORM_WHATSAPP_NUMBER`, a placeholder for now per AGENTS.md Section 6 — TBD real number from the client), the same no-API pattern already used for enquiries, not the real WhatsApp API/BSP integration AGENTS.md flags as a separate open decision.
**Done when:** a buyer can submit a requirement, it appears in the public list when marked visible, and the WhatsApp message is received.
- [x] Design it (spec): decided inline (see note above), no `docs/specs/` entry
- [x] Build it: `/develop post buy requirement`
   - [x] `create_buy_requirement` RPC: buyer resolution, a 3/hour rate limit (heavier action than an enquiry, so a lower cap), no dedup (distinct requirements from the same buyer are legitimate)
   - [x] `postBuyRequirement` server action + `BuyRequirementForm`; `/buy-requirements/new` (post) and `/buy-requirements` (full public listing, fixing the two nav links that already pointed here)
- [ ] Verify it: `/check verify post buy requirement`
- [ ] Test it: `/test post buy requirement`
- [ ] Review it (fresh model): `/check review post buy requirement`
- [ ] Document it: `/document post buy requirement`
code in `supabase/migrations/20260909050000_add_create_buy_requirement.sql`, `lib/actions/post-buy-requirement.ts`, `components/buy-requirement-form.tsx`, `app/buy-requirements/new/page.tsx`, `app/buy-requirements/page.tsx`, `.env.local`

### 9. Enquiries on companies & buy requirements · in-progress
Extend the Send Enquiry action already proven in the core loop (feature 4) to company profile pages and buy requirement listings. The company half is built: a new `create_company_enquiry` RPC mirrors `create_enquiry` exactly (buyer resolution, the same global per-buyer rate limit, a 10-minute dedup window scoped to the company, `product_id` left null), and `SendEnquiryDialog`/`sendEnquiry` were generalized to a `target: {type: "product"|"company"}` union rather than duplicated. The buy requirement half needs a decision first (see its box below), not a feature-8 dependency — feature 8 now exists.
**Done when:** Send Enquiry works from a company page and from a buy requirement, using the same write-and-WhatsApp-forward path the core loop already proved.
- [x] Build it (company half): `/develop enquiries on companies`
   - [x] `create_company_enquiry` RPC, mirroring `create_enquiry`'s rate limit/dedup/buyer-resolution shape
   - [x] `sendEnquiry`/`SendEnquiryDialog` generalized to a product/company target union
   - [x] Wired onto `/companies/[slug]`; live-verified via the RPC directly (dedup returns the same `enquiry_id`) and via the running dev server (button renders on both pages)
- [ ] Build it (buy requirement half): needs a decision, not just a build — feature 8 now exists, but a buy requirement has no public company-style WhatsApp contact to route to; the only recipient is the posting buyer's own phone number, which is private PII (`buyers` has no RLS policy at all, unlike a company's public contact). Handing that number to any anonymous visitor who clicks "enquire," or exposing it via a wa.me link, is a materially different privacy posture than the product/company cases and isn't specified in AGENTS.md/PRD. Route to `/architect` before building: who actually receives this enquiry, and how.
code in `supabase/migrations/20260909040000_add_company_enquiry.sql`, `lib/actions/send-enquiry.ts`, `components/send-enquiry-dialog.tsx`, `app/companies/[slug]/page.tsx`, `app/products/[slug]/page.tsx`

### 10. Supplier business listing · in-progress
A supplier turns their Clerk account into a real, pending business listing: name, location, logo, business email, and a WhatsApp contact number, created together as one atomic step. It stays `pending` until an admin approves it in the separate admin app; a rejected listing shows why and can be edited and resubmitted. (The approval action itself lives in the separate admin app; this feature is only the supplier-facing listing side.) This is the first half of what was originally scoped as supplier self-service submission; submitting products under an approved company is its own follow-on feature (16), deferred until a real approved company exists to design and build against.
**Done when:** a supplier can submit their business listing (name, location, logo, business email, WhatsApp number), it is stored `pending` with its WhatsApp contact created atomically, it never appears on any public read path until approved, and a rejected listing shows the reason and can be fixed and resubmitted.
- [x] Design it (spec): `/architect supplier business listing`
- [x] Build it: `/develop supplier business listing`
   - [x] Schema: widen `companies.status` to allow `rejected`, add `rejection_reason` (AC-5, AC-6, AC-7)
   - [x] Atomic DB functions: `create_business_listing`, `update_business_listing` (AC-2, AC-5, AC-6)
   - [x] Data layer & server actions: `getMyCompany`, `submitBusinessListing`, `updateBusinessListing`, logo upload + storage config (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-10)
   - [x] `/list-business` page and rewiring the "List Your Business Free" CTAs (AC-1, AC-4, AC-5, AC-6, AC-7, AC-11)
- [ ] Verify it: `/check verify supplier business listing`
- [ ] Test it: `/test supplier business listing`
- [ ] Review it (fresh model): `/check review supplier business listing`
- [ ] Document it: `/document supplier business listing`
spec [0005](../specs/0005-supplier-business-listing/index.md) · code in `supabase/migrations/20260903120000_add_business_listing.sql`, `supabase/migrations/20260903120500_add_business_listing_rate_limit.sql`, `supabase/migrations/20260903121000_fix_update_business_listing_conflict_target.sql`, `supabase/migrations/20260903130000_add_business_listing_email.sql`, `lib/supabase/queries/companies.ts`, `lib/actions/business-listing.ts`, `app/list-business/page.tsx`, `components/business-listing-form.tsx`

### 16. Supplier product submission · needs a decision · from spec 0005
An approved supplier submits their own product (name, category, images) from their own dashboard; it stays `pending` until an admin approves it in the separate admin app. Deferred out of feature 10 (spec 0005's Follow-up) until a real approved company exists to design and build against; gated on `companies.status = 'approved'`.
**Done when:** an approved supplier can submit a product with images, it is stored `pending`, and it does not appear on any public read path until approved.
- [ ] Design it (spec): `/architect supplier product submission`

## Slice 4: revenue

### 11. Membership plans & Razorpay · needs a decision
Basic/Silver/Gold tiers; a supplier upgrades and pays via Razorpay; a successful payment auto-upgrades the account (badge, ranking boost, featured placement).
**Done when:** a supplier can choose Silver or Gold, pay via Razorpay, and their membership tier updates automatically on successful payment, with the payment logged.
- [ ] Design it (spec): `/architect membership plans & razorpay`

## Slice 5: findability

### 12. AI-powered / semantic search · needs a decision
Fast product/company search with spelling tolerance and instant suggestions, built on Supabase semantic matching, not a third party search SaaS.
**Done when:** search returns relevant results tolerant of common typos and updates as the user types.
- [ ] Design it (spec): `/architect ai-powered search`

### 13. SEO & GEO · planned
Sitemap, per-page metadata and structured data, clean URLs, and AI-crawler readiness, per PRD Sections 8 to 9 and the installed `seo-aeo-best-practices` skill.
**Done when:** every product and company page has correct metadata and structured data, a sitemap exists, and crawler access is configured.
- [ ] Build it: `/develop seo & geo`

### 14. PostHog analytics · planned
Page views, search behavior, and enquiry funnel drop-off tracked via PostHog.
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

# 0001. Database schema and access model

**Date**: 2026-08-27
**Status**: Accepted

## Summary

This spec defines the seven core Supabase tables the whole storefront reads and writes (companies, products, categories, buy requirements, enquiries, memberships, buyers), and how access is controlled given that Clerk, not Supabase Auth, manages who is signed in. Every write goes through a server route that checks the Clerk session itself, not through database level row ownership rules. A small number of narrow, read only database views expose derived public facts (a company's current membership tier, directory wide counts) safely, without opening the underlying private tables to public reads. This spec was cross checked by an independent model after the first draft, which caught a real bug (a table constraint that contradicted its own delete behavior) and several other gaps; this version has all of them resolved.

## Requirements

**User stories**:
- As a buyer, I want to send an enquiry or post a buy requirement without creating an account, so that contacting a supplier is frictionless.
- As a supplier, I want only my own company and products editable by me, so another supplier cannot tamper with my listings.
- As the business owner, I want every enquiry and membership payment durably recorded, so no lead or payment is ever lost, even if the product or company it was about is later deleted.
- As a visitor, I want to see only approved, public listings, so the directory never shows unfinished, rejected, or unapproved content.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: All seven tables (`companies`, `products`, `categories`, `buy_requirements`, `enquiries`, `memberships`, `buyers`), the two views (`company_tiers`, `directory_stats`), and every column, type, and constraint in `## Feature design` exist, and generated TypeScript types reflect them, in both `expoters-assam` and `expoters-assam-admin`.
- **AC-2**: RLS is enabled on every table, with no `INSERT`/`UPDATE`/`DELETE` possible for the `anon` or `authenticated` role on anything (enforced by an explicit revoke, not policy absence alone). The public role can `SELECT` only: `companies` where `status = 'approved'`, `products` where `status = 'approved'`, all `categories` rows, `buy_requirements` where `is_public = true`, and the two narrow views (`company_tiers`, `directory_stats`). It can read nothing else, including no row of `enquiries`, `memberships`, or `buyers`.
- **AC-3**: A `products` row can never have a blank `name` or a blank `image_url` (DB enforced, not just `NOT NULL`), and `rejection_reason` can only be set when `status = 'rejected'`.
- **AC-4**: Submitting a second enquiry or buy requirement with a phone number that normalizes to the same value as an existing `buyers` row reuses that row, atomically, even when two submissions arrive concurrently for a brand new number. A backfilled `email` never overwrites one already on file.
- **AC-5**: Deleting a `products`, `companies`, or `buyers` row never fails because of an `enquiries` row referencing it, and never silently drops that `enquiries` row. A `buyers` row with any enquiry or buy requirement history cannot be deleted at all. A product or company deletion nulls the corresponding `enquiries` foreign key, but the enquiry's snapshot columns (`product_name`, `company_name`, `contact_name`) keep it readable regardless.
- **AC-6**: A `memberships` row's `razorpay_payment_id`, when set, is unique; a webhook retry hitting the same payment id is a no-op, not an error. A company has at most one `active` membership row at any time.
- **AC-7**: A company's current membership tier is always read through the `company_tiers` view (derived from `memberships`, defaulting to `basic`), never a stored column, and is joinable/sortable in one query so listings can rank by tier.
- **AC-8**: A `companies` or `products` row created by a supplier starts `pending` and is invisible to the public role; one created by admin starts `approved` and is immediately visible.
- **AC-9**: Every `buyers.phone` value stored in the database matches the normalized format (a leading `+` and digits only), regardless of what the submitter typed, enforced by a trigger, not application code alone.

## Decision

**Chosen option**: Option 1: Server route checks only, no RLS ownership policies.

Every write to `companies`, `products`, `categories`, `buy_requirements`, `enquiries`, and `memberships` happens through a server route or server action using `supabaseAdmin`, after that route checks the Clerk session owns (or is allowed to touch) the row. RLS stays enabled everywhere and is the only thing the `anon`/`authenticated` role can ever do, and only `SELECT` on the narrow public surface in AC-2; it never encodes per user ownership. A small number of narrow database views (not the underlying tables) safely expose derived public facts.

**Implementation skills**: `supabase` (`supabase/supabase`, `.claude/skills/supabase/`) · `supabase-postgres-best-practices` (`supabase/supabase`, `.claude/skills/supabase-postgres-best-practices/`)

## Feature design

**Data model sketch**:

| Table | Column | Type | Nullable | Notes |
|---|---|---|---|---|
| **companies** | `id` | uuid, pk | no | `default gen_random_uuid()` |
| | `clerk_user_id` | text | yes | unique when set; the supplier's Clerk account, if one is linked |
| | `name` | text | no | `check (length(btrim(name)) > 0)` |
| | `logo_url` | text | yes | |
| | `about` | text | yes | |
| | `location` | text | yes | city/state |
| | `country` | text | no | default `'India'` |
| | `verified` | boolean | no | default `false` |
| | `status` | text | no | check in (`pending`, `approved`), default `'pending'` — mirrors `products`; admin created rows start `approved` |
| | `submitted_by` | text | no | check in (`supplier`, `admin`) |
| | `created_at` | timestamptz | no | default `now()` |
| | `updated_at` | timestamptz | no | default `now()`, kept current by a trigger |
| **products** | `id` | uuid, pk | no | `default gen_random_uuid()` |
| | `company_id` | uuid, fk → companies.id | no | `ON DELETE CASCADE` |
| | `category_id` | uuid, fk → categories.id | no | `ON DELETE RESTRICT` |
| | `name` | text | no | `check (length(btrim(name)) > 0)` |
| | `description` | text | yes | |
| | `image_url` | text | no | `check (length(btrim(image_url)) > 0)`, the cover image |
| | `gallery_urls` | text[] | no | default `'{}'`, additional images beyond the cover |
| | `status` | text | no | check in (`pending`, `approved`, `rejected`), default `'pending'` |
| | `submitted_by` | text | no | check in (`supplier`, `admin`) |
| | `rejection_reason` | text | yes | `check (status = 'rejected' or rejection_reason is null)` |
| | `approved_by` | text | yes | admin's Clerk user id, set on approve/reject |
| | `approved_at` | timestamptz | yes | |
| | `created_at` | timestamptz | no | default `now()` |
| | `updated_at` | timestamptz | no | default `now()`, kept current by a trigger |
| **categories** | `id` | uuid, pk | no | `default gen_random_uuid()` |
| | `name` | text | no | unique |
| | `slug` | text | no | unique |
| | `created_at` | timestamptz | no | default `now()` |
| **buyers** | `id` | uuid, pk | no | `default gen_random_uuid()` |
| | `name` | text | no | |
| | `phone` | text | no | unique, normalized to `+<digits>` by a trigger before every insert/update (AC-9); `check (phone ~ '^\+[1-9][0-9]{9,14}$')` |
| | `phone_raw` | text | yes | exactly what the submitter typed, kept for reference |
| | `email` | text | yes | |
| | `created_at` | timestamptz | no | default `now()` |
| **buy_requirements** | `id` | uuid, pk | no | `default gen_random_uuid()` |
| | `buyer_id` | uuid, fk → buyers.id | no | `ON DELETE RESTRICT` — a buyer with history cannot be deleted (AC-5) |
| | `category_id` | uuid, fk → categories.id | yes | `ON DELETE SET NULL` |
| | `product_text` | text | no | free text: what they want |
| | `quantity` | text | no | free text, units vary |
| | `location` | text | yes | |
| | `notes` | text | yes | |
| | `contact_name` | text | no | snapshot of the submitter's name at time of posting (a shared/reassigned phone number never loses who actually asked) |
| | `contact_email` | text | yes | snapshot |
| | `is_public` | boolean | no | default `true` |
| | `created_at` | timestamptz | no | default `now()` |
| **enquiries** | `id` | uuid, pk | no | `default gen_random_uuid()` |
| | `buyer_id` | uuid, fk → buyers.id | no | `ON DELETE RESTRICT` — a buyer with history cannot be deleted (AC-5) |
| | `product_id` | uuid, fk → products.id | yes | `ON DELETE SET NULL` |
| | `company_id` | uuid, fk → companies.id | yes | `ON DELETE SET NULL`; always denormalized from `products.company_id` at insert time for a product enquiry, so "enquiries for this company" survives a product deletion |
| | `buy_requirement_id` | uuid, fk → buy_requirements.id | yes | `ON DELETE SET NULL` |
| | `product_name` | text | yes | snapshot, set at insert time when `product_id` is set |
| | `company_name` | text | yes | snapshot, set at insert time |
| | `contact_name` | text | no | snapshot of the submitter's name |
| | `contact_email` | text | yes | snapshot |
| | `message` | text | yes | |
| | `whatsapp_forwarded_at` | timestamptz | yes | set only after the WhatsApp API call returns success |
| | `whatsapp_attempts` | integer | no | default `0`, incremented on each send attempt |
| | `whatsapp_last_error` | text | yes | the most recent failure, if any |
| | `created_at` | timestamptz | no | default `now()` |
| **memberships** | `id` | uuid, pk | no | `default gen_random_uuid()` |
| | `company_id` | uuid, fk → companies.id | no | `ON DELETE CASCADE` |
| | `tier` | text | no | check in (`silver`, `gold`) — Basic has no row |
| | `razorpay_payment_id` | text | yes | unique when set (AC-6) |
| | `razorpay_order_id` | text | yes | |
| | `status` | text | no | check in (`active`, `expired`, `cancelled`) |
| | `source` | text | no | check in (`self-serve`, `admin-manual`) |
| | `starts_at` | timestamptz | no | default `now()` |
| | `expires_at` | timestamptz | yes | null if indefinite |
| | `created_at` | timestamptz | no | default `now()` |

**Constraints and triggers not shown in the table above**:
- `enquiries`: the "at least one of `product_id` / `company_id` / `buy_requirement_id`" rule is enforced by a `BEFORE INSERT` trigger, **not** a table `CHECK`. A table `CHECK` would re-validate on every later `UPDATE` too, including the `ON DELETE SET NULL` cascades from `products`/`companies` — which would then reject the very deletes AC-5 requires to succeed. The trigger only runs at insert, so a later cascade nulling all three columns is allowed; the snapshot columns keep the row meaningful anyway.
- `memberships`: a partial unique index, `create unique index on memberships (company_id) where status = 'active'`, so a company can never have two active memberships at once (AC-6).
- `buyers.phone`: a `BEFORE INSERT OR UPDATE` trigger normalizes the value (strip everything but digits, assume `+91` for a bare 10 digit Indian number, prefix `+`) before the unique constraint and the format check apply (AC-9). This is a deliberately simple, India centric normalization, not full international parsing; see Follow-up.
- Every table has RLS enabled, and `revoke insert, update, delete on all tables in schema public from anon, authenticated;` is applied explicitly, so a future migration that adds a table without remembering RLS does not silently become a public write credential.

**Two narrow public views** (the only way the `anon`/`authenticated` role reaches derived facts about otherwise locked down tables):

```sql
-- Deliberately does NOT set security_invoker = on: the whole point is to expose one
-- narrow, safe derived fact from a table (memberships) anon cannot read directly.
create view public.company_tiers as
select
  c.id as company_id,
  coalesce(
    (select m.tier from memberships m
     where m.company_id = c.id and m.status = 'active'
     order by m.starts_at desc limit 1),
    'basic'
  ) as tier
from companies c
where c.status = 'approved';

grant select on public.company_tiers to anon, authenticated;

create view public.directory_stats as
select
  (select count(*) from companies where status = 'approved' and verified = true) as verified_exporters,
  (select count(*) from products where status = 'approved') as products,
  (select count(distinct buyer_id) from enquiries) as buyers,
  (select count(distinct country) from companies where status = 'approved') as countries;

grant select on public.directory_stats to anon, authenticated;
```

`company_tiers` exposes only `company_id` and `tier`, never `razorpay_payment_id` or any other membership detail. It is also what makes AC-7's "joinable/sortable" requirement possible: a listing query joins against this view to order by tier instead of running one query per row.

**State transitions**:
- `companies.status` / `products.status`: `pending` → `approved` | `rejected` for products (`companies` has no `rejected` state, only `pending` → `approved`), set by an admin action in the separate admin app. `admin`-submitted rows are created directly at `approved`, skipping `pending`.
- `memberships.status`: `active` → `expired` | `cancelled`. An upgrade (a new `active` row for a company) and expiring the company's previous `active` row happen together in one transaction, so the partial unique index is never violated mid flight.

**API surface**:

This spec defines the data layer and its access rules, not a specific feature's endpoints; no route belongs to this spec. The contract every future route follows: a mutating request is a Next.js server route or server action; it authenticates the caller via Clerk (`auth()` from `@clerk/nextjs/server`), authorizes the specific action (e.g. "does this Clerk user own this `company_id`", via the `assertOwnsCompany` helper below), then writes with `lib/supabase/admin.ts`'s `supabaseAdmin`. No client component ever imports `supabaseAdmin`. The public read client (`lib/supabase/client.ts`'s `supabase`) is used directly from server or client components for the RLS-gated public reads in AC-2 and the two views; it is never used to write. Concrete endpoints (`POST` enquiry, `POST` buy requirement, the product submission form, the membership checkout flow) are each specified in their own feature's spec (scope features 4, 8, 10, 11). How an admin user is distinguished from any other Clerk user (a role claim, `publicMetadata`, or an allowlist) is not decided here; it is owed to the admin app's own spec, flagged in Follow-up.

**Value sourcing**:

| Value | Source |
|---|---|
| A buyer row for a new enquiry/requirement | Looked up by normalized `phone` (AC-4/AC-9); `insert ... on conflict (phone) do update set email = coalesce(buyers.email, excluded.email) returning id`, atomic under concurrent submissions |
| `enquiries.company_id` on a product enquiry | Denormalized from `products.company_id` by the server route at insert time, not left for the client to supply |
| `enquiries.product_name` / `company_name` | Copied from the referenced row by the server route at insert time (a point in time snapshot, not a live join) |
| `enquiries.contact_name` / `contact_email` | The name/email the buyer typed on this specific submission (may differ from `buyers.name`/`email` if a phone line is shared) |
| A product's current visibility | `products.status = 'approved'`, set by the admin approval action, never by the submitter |
| A company's displayed membership tier / badge | The `company_tiers` view, never a stored field (AC-7) |
| Home page stats (verified exporters, products, buyers, countries) | The `directory_stats` view |
| The admin who approved or rejected a product | The Clerk session in the admin app's approval route, written to `products.approved_by` |
| Whether a WhatsApp forward succeeded | `enquiries.whatsapp_forwarded_at`, set by the server route only after the WhatsApp API call returns success; `whatsapp_attempts`/`whatsapp_last_error` track retries so a sweep can distinguish "never tried" from "tried and failed" |

**Key invariants**:
- `products.name`, `products.image_url`, `companies.name` can never be blank strings, DB enforced (AC-3).
- `memberships.razorpay_payment_id` is unique when set, and a company has at most one `active` membership row at any time (AC-6).
- `buyers.phone` is always stored normalized; the unique constraint applies to that normalized value (AC-4, AC-9).
- `enquiries` always had at least one of `product_id` / `company_id` / `buy_requirement_id` set **at creation**; a later deletion elsewhere may null all three, and that is allowed, the snapshot columns keep the row meaningful.
- A `buyers` row with any `enquiries` or `buy_requirements` history can never be deleted (AC-5).
- A company's tier is always derived through `company_tiers`, never stored (AC-7).
- A membership upgrade (a new `active` row) and expiring the company's previous `active` row happen in one transaction.

**Security model**:
- Public (`anon`/`authenticated`) role: `SELECT` only, on `companies` (`status = 'approved'`), `products` (`status = 'approved'`), `categories` (all rows), `buy_requirements` (`is_public = true`), and the two views. Every other `SELECT` and every `INSERT`/`UPDATE`/`DELETE` is blocked by RLS plus the explicit revoke.
- `enquiries`, `memberships`, `buyers`: no policy at all; only `supabaseAdmin` (service role, bypasses RLS) can touch these, only from a server route that has already checked the Clerk session.
- Ownership checks live in one shared, testable helper per app (not shared across apps, per `AGENTS.md` Section 3): `lib/auth/assert-company-owner.ts`, exporting `assertOwnsCompany(clerkUserId: string, companyId: string): Promise<void>` (throws on mismatch), resolving ownership via `companies.clerk_user_id`. Every mutating route calls it before writing.
- No compliance regime is named in the PRD (this is a regional B2B directory, not a regulated data handler), but `buyers.phone`/`email`/`phone_raw`, `enquiries.contact_email`, and `enquiries.message` are still personal contact information: never expose them through a public-readable table, view, or API response.

**Configuration required**: none new. This spec uses the `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` already configured in both apps. Two Supabase Storage buckets (`product-images`, `company-logos`) are created as part of this spec's build plan (see below); no new environment variables are needed for them. **Superseded by [0004](../0004-cloudflare-r2-image-storage/index.md):** image storage moved to Cloudflare R2; these two buckets stay in place with public read revoked, not deleted, but nothing should be built against them going forward. The rest of this spec (schema, RLS, security model) is unaffected and stays `Accepted`.

**Critical test scenarios**:
- Happy path: a visitor queries `products` with the anon client and sees only `approved` rows, verifies **AC-2**, **AC-8**.
- Happy path: the same phone number, typed two different ways (`9876543210` and `+91 98765 43210`), submits two enquiries; both normalize to the same value and link to the same `buyers.id`, verifies **AC-4**, **AC-9**.
- Happy path: a company's tier badge is read via `company_tiers` and matches its latest active membership, verifies **AC-7**.
- Failure case: deleting a `products` row that has existing `enquiries` referencing it succeeds; those `enquiries` rows survive with `product_id` null but `product_name` still populated, verifies **AC-5**.
- Failure case: deleting a `buyers` row that has any `enquiries` or `buy_requirements` is rejected by the database, verifies **AC-5**.
- Failure case: two enquiry submissions for a brand new phone number arrive concurrently; both succeed, and exactly one `buyers` row is created, verifies **AC-4**.
- Failure case: a webhook delivers the same `razorpay_payment_id` twice; the second call is a no-op, not an error, and the company still has exactly one `active` membership row, verifies **AC-6**.
- Auth/permission: an anon Supabase client attempting to `SELECT` from `enquiries`, `memberships`, or `buyers`, or to `INSERT` into any table, gets zero rows or a permission error, never data, verifies **AC-2**.

## Build plan

1. Write the migration creating all seven tables, the two views, every constraint, trigger, and default in `## Feature design` (the `enquiries` `BEFORE INSERT` trigger, the `buyers.phone` normalization trigger, the `memberships` partial unique index, the blank-string `CHECK`s), satisfies **AC-1**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-8**, **AC-9**
2. Enable RLS on every table, write the anon/authenticated `SELECT` policies exactly as in the Security model, `grant select` on the two views, and run the explicit `revoke insert, update, delete ... from anon, authenticated`, satisfies **AC-2**
3. Create the `product-images` and `company-logos` Storage buckets, each with a public read policy and no anon write policy (uploads go through server routes using `supabaseAdmin`, consistent with the rest of the access model); the upload UX itself belongs to scope feature 10
4. Add `lib/auth/assert-company-owner.ts` in the storefront (`assertOwnsCompany`), satisfies the Security model's ownership check requirement
5. Add `getCurrentTier(companyId)` and a batch `getCurrentTiersFor(companyIds)` query helper (querying `company_tiers`) to `lib/supabase/queries/` in both apps, satisfies **AC-7**
6. Add `getOrCreateBuyerByPhone(phone, name, email)` to `lib/supabase/queries/` in the storefront, using the `on conflict (phone) do update` pattern in Value sourcing, satisfies **AC-4**
7. Run `supabase db push` from `expoters-assam` (the sole schema owning repo, see Consequences) to apply the migration, then `supabase gen types typescript --linked > lib/supabase/database.types.ts` in `expoters-assam`, and copy the generated file to `expoters-assam-admin`, satisfies **AC-1**
8. Verify with a manual query against each anon-gated table and view, and the concurrent-insert and duplicate-webhook scenarios (per Critical test scenarios above), before marking this feature `done`

## Consequences

**Positive**:
- Every table needed by the next five scope features (product page, listings, buy requirements, supplier submission, membership) exists in one pass; no feature blocks on a follow-up migration.
- No lead or payment data can be silently lost to a cascade delete, a race condition, or a duplicate webhook (AC-4, AC-5, AC-6), and a deleted product or company's enquiries stay meaningful via their snapshot columns.
- `company_tiers` and `directory_stats` make tier based ranking and home page stats possible in plain SQL, not N application level queries per listing.

**Negative / tradeoffs**:
- No database level enforcement of "a supplier can only touch their own company"; that logic lives in `assertOwnsCompany`, called by every mutating route, and a bug there is a real risk with no second layer catching it.
- The browser can never query Supabase directly for a supplier's own data; every such read is an extra server round trip. Acceptable at this project's scale.
- `buyers.phone` normalization is a simple, India centric rule (strip non digits, assume `+91` for a bare 10 digit number), not full international phone parsing; a genuinely international buyer base would need revisiting this.
- A soft delete (`archived_at` on `companies`/`products` instead of a real `DELETE`) was considered as a materially simpler alternative to the snapshot-plus-`SET NULL` design and would sidestep the whole cascade question, but was not chosen: it pushes an "and not archived" filter into every query across two independent apps with no shared code, a wider and more error prone surface than the trigger plus snapshot columns chosen here.

**Neutral**:
- Both apps (`expoters-assam`, `expoters-assam-admin`) need their own copy of `assertOwnsCompany`, `getCurrentTier`/`getCurrentTiersFor`, and `getOrCreateBuyerByPhone` (the latter only if the admin app ever needs to record a buyer directly), since nothing is shared via code between them (`AGENTS.md`, Section 3). Keep the copies in sync by hand; the `buyers.phone` normalization trigger being in the database (not application code) means this particular piece cannot drift between the two apps even if the copies do.
- `expoters-assam/supabase/migrations/` is the sole source of schema truth; `expoters-assam-admin` must never create its own `supabase/` directory or migration.

## Follow-up

- [ ] If a future feature needs the browser to query Supabase directly on a signed in supplier's behalf (e.g. a live updating dashboard), revisit this spec and evaluate wiring Clerk as a Supabase Third Party Auth provider, rather than bolting on a partial version of it.
- [ ] Rate limiting on the public enquiry and buy requirement submission endpoints is out of scope for this spec (no endpoint is defined here), but the feature spec that defines them (scope feature 4, "Product page & Send Enquiry") must not skip it.
- [ ] How an admin Clerk user is distinguished from any other Clerk user (role claim, `publicMetadata`, allowlist) is not decided here; the admin app's own spec owes this decision before the approval routes it depends on (`products.approved_by`, `memberships.source = 'admin-manual'`) can be built.
- [ ] Upload validation (file size, type, image dimensions) for `product-images`/`company-logos` is not specified here; it belongs to scope feature 10's spec.
- [ ] `buyers.phone` normalization is intentionally simple and India centric (see Consequences); revisit if the buyer base becomes meaningfully international.
- [ ] Consider a dedicated `audit_log` table if the client later wants full change history beyond `products.approved_by`/`approved_at` and the `memberships` payment log; not added now since nothing in the current scope requires more than these two audit trails.

## Rationale

Reasoning and options: see `rationale.md`.

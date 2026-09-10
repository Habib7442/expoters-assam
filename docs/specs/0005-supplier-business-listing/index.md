# 0005 · Supplier business listing

**Date**: 2026-09-03
**Status**: In Progress

## Summary

This spec designs the first half of scope feature 10 (supplier self-service listing): how a supplier turns a Clerk account into a real, pending business listing that an admin can later approve in the separate admin app. A signed in supplier fills in one form (business name, location, logo, WhatsApp number, an optional description) and that creates their company (companies row) and its contact number (company_contacts row) together, in one atomic step, as `pending`. The same page later shows them their status (pending, approved, or rejected) and lets them fix and resubmit a rejected listing. Submitting products under an approved company (feature 10's other half) is a separate, later spec and build, once a real approved company exists to build it against.

## Requirements

**User stories**:
- As a visitor who wants to sell on ExportsAssam, I want to sign up and list my business, so buyers can eventually find me once an admin approves my listing.
- As a supplier whose listing is still pending, I want to see that status and fix a mistake if I made one, so I am not stuck waiting with no way to correct my submission.
- As a supplier whose listing was rejected, I want to see why and fix it, so I can get approved without starting over.
- As a supplier whose listing is approved, I want to see that it is live, so I know I can move on to listing products.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: A signed in Clerk user with no `companies` row yet, visiting `/list-business`, sees an empty business listing form (name, location, logo image, business email, WhatsApp number, optional about text). A signed out visitor visiting `/list-business` is sent to sign in first, then lands back on `/list-business`.
- **AC-2**: Submitting the form with a name, a location, a logo image, a valid business email, and a valid WhatsApp number creates exactly one `companies` row (`status = 'pending'`, `submitted_by = 'supplier'`, `clerk_user_id` = the signed in user, `country` defaulted to `'India'`) and exactly one `company_contacts` row (the WhatsApp number, normalized by the existing DB trigger) in one atomic step. A company is never created without its contact number, or the reverse.
- **AC-3**: Submitting with a missing name, location, logo, email, or WhatsApp number, or an email or WhatsApp number that fails validation, is rejected with a clear per field error and creates no row at all.
- **AC-4**: A signed in Clerk user who already has a `companies` row, visiting `/list-business`, sees their status (pending, approved, or rejected) and the details they submitted, never the empty form from AC-1.
- **AC-5**: When status is `pending` or `rejected`, that same view is an editable, pre filled form. Saving an edit updates the row; saving an edit on a `rejected` listing automatically flips its status back to `pending` and clears `rejection_reason` in the same write.
- **AC-6**: When status is `approved`, the view is read only in this pass (no self edit), confirms the listing is live, and this is enforced at the write layer, not only by hiding the form: a write attempt against an `approved` company through this feature's surface is rejected, never silently accepted.
- **AC-7**: When status is `rejected`, the supplier sees the `rejection_reason` the admin set, if any.
- **AC-8**: A `pending` or `rejected` company is never returned by any public read path (the home page's Featured Exporters, category counts, `directory_stats`, or a future company profile page); this already holds via the existing `status = 'approved'` RLS policy from spec 0001, unaffected by this feature, and this pass adds no new public read path that could bypass it.
- **AC-9**: One Clerk user can own at most one company. The existing `clerk_user_id unique` constraint already guarantees this at the database layer; this feature additionally prevents a signed in user from ever seeing or submitting a second creation form once they have a row (AC-4 routes them to their status view instead).
- **AC-10**: The logo image uploads through a server side action, never from the browser directly. **Amended 2026-09-09**: the upload target is Cloudflare R2 (`lib/storage/r2.ts`, spec 0004), not the `company-logos` Supabase Storage bucket this AC originally named — that bucket's public read has since been revoked entirely (spec 0004's AC-6). The browser never receives an R2 credential either way.
- **AC-11**: Every "List Your Business Free" call to action already on the site (the hero and the signup band on the home page) links to `/list-business` instead of directly to `/sign-up`.

## Decision

**Chosen option**: Option 1: explicit listing form, no auto created stub.

A `companies` row is created only when a supplier completes and submits the `/list-business` form; nothing is created at sign up time. The form and its edit view share one route and one atomic database function for the write.

**Implementation skills**: `clerk-nextjs-patterns` (`clerk/clerk-nextjs-patterns`, `.claude/skills/clerk-nextjs-patterns/`) · `supabase-postgres-best-practices` (`supabase/supabase-postgres-best-practices`, `.claude/skills/supabase-postgres-best-practices/`)

## Rationale

Full reasoning and the rejected alternative: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:
- `companies` (existing table, three changes): the `status` check constraint currently only allows `('pending', 'approved')` (live schema, `20260827065400_create_core_schema.sql`) and must be widened to `('pending', 'approved', 'rejected')`, since `rejected` does not exist in the database today. Adds `rejection_reason text` with a check mirroring `products.rejection_reason` exactly: `check (status = 'rejected' or rejection_reason is null)`. Adds `email text not null` (a required business email, decided inline with the engineer after the initial design pass; `companies` had no email column at all), with a basic format check (`check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')`); since one row already existed (the spec 0003 demo company), this was added nullable, backfilled, then set not null. Every other column (`name`, `about`, `country`, `location`, `logo_url`, `submitted_by`, `verified`, `clerk_user_id unique`) is unchanged.
- `company_contacts` (existing table, unchanged): `company_id` (PK, FK to `companies`, one to one), `whatsapp_number` (not null, `check (whatsapp_number ~ '^\+[1-9][0-9]{9,14}$')`, normalized by the existing `normalize_company_whatsapp_number` trigger before that check runs).
- No changes to `products`; product submission is a later, separate spec, gated on `companies.status = 'approved'`.
- Storage: logo objects are keyed `{clerkUserId}/{crypto.randomUUID()}.{ext}` (not `{companyId}`, since no id exists yet at first upload) under R2's `logos/` category (spec 0004, amended 2026-09-09 from the original `company-logos` Supabase Storage bucket); accepted types `image/jpeg`, `image/png`, `image/webp`; max 2 MB, checked client side before upload and re-checked server side.

**State transitions** (`companies.status`, after the constraint widening above):
`pending` → `approved` (admin, in the separate admin app, out of this repo)
`pending` → `rejected` (admin, in the separate admin app, out of this repo, and only possible once the constraint above ships)
`rejected` → `pending` (this feature: the supplier edits their listing; `rejection_reason` is cleared in the same update, AC-5)
`approved` is terminal in this pass: no self edit and no admin revoke flow built here, and the update path below refuses to touch a row in this state (AC-6), not just the UI.

**API surface** (server actions, matching the existing `sendEnquiry` convention, not REST routes):
| Surface | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `getMyCompany(clerkUserId)` | read (RSC query helper) | `clerkUserId`, from the caller's Clerk session, never a route param | the caller's `companies` row (including `email`) plus its `company_contacts.whatsapp_number`, or `null` | signed in Clerk session (the page passes the session's `userId` in) | none, `null` on no row |
| `submitBusinessListing(formData)` | server action | `name`, `location`, `logoFile`, `email`, `whatsappNumber`, `about?` | the created company's `id` and `status` | signed in Clerk session, must have no existing company | `not_signed_in`, `already_listed`, `invalid_input` (per field), `upload_failed`, `server_error` |
| `updateBusinessListing(formData)` | server action | `name`, `location`, `logoFile?`, `email`, `whatsappNumber`, `about?` (no `companyId` input; the row is located by the session's `clerk_user_id`, removing any client supplied id) | the updated company's `id` and `status` | signed in Clerk session, row must belong to the caller and be `pending` or `rejected` | `not_signed_in`, `not_found`, `not_editable` (row is `approved`), `rate_limited` (a save within 10 seconds of the last one), `invalid_input`, `upload_failed`, `server_error` |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Render `/list-business` (no company) | empty form | AC-1, no prior data |
| Render `/list-business` (has company) | current status, submitted fields, `rejection_reason` | `getMyCompany(clerkUserId)`, the caller's own row (companies + company_contacts joined) |
| Submit new listing | `name`, `location`, `about`, `email`, `whatsappNumber` | form input |
| Submit new listing | `clerk_user_id` | the signed in Clerk session server side (`auth()`), never a client supplied value |
| Submit new listing | `country` | hardcoded default `'India'`, per the decision to not collect it on this form |
| Submit new listing | `status` | hardcoded `'pending'` |
| Submit new listing | `submitted_by` | hardcoded `'supplier'` |
| Submit new listing | `logo_url` | `uploadToR2("logos", key, ...)`'s returned public URL (spec 0004; amended 2026-09-09 from Supabase Storage) after the upload to the key named in Data model sketch succeeds |
| Submit new listing | `already_listed` rejection | the authoritative source is a `23505` unique violation on `companies_clerk_user_id_key` from `create_business_listing`, mapped to this error code; `getMyCompany` is only a UX pre-check (routes the page to the status view before the user even opens the form), not the source of truth, since two concurrent submits from the same user must still resolve to exactly one row |
| Submit new listing | WhatsApp field error vs. generic error | a `23514` check violation on `company_contacts.whatsapp_number` from the write is mapped to a field level `invalid_input.whatsappNumber` error, not `server_error`; the zod schema also pre-validates a plausible digit count so most bad input never reaches the database |
| Submit new listing | Email field error vs. generic error | a `23514` check violation on `companies_email_check` is mapped to a field level `invalid_input.email` error; zod's `.email()` also pre-validates client and server side before the write |
| Edit an existing listing | `status` transition | `rejected` → `pending` (with `rejection_reason` cleared) on any successful save (AC-5); `pending` stays `pending`; a row in `approved` is not returned by the update (zero rows affected → `not_editable`, AC-6) |
| Edit an existing listing | which row to update | `where clerk_user_id = <the caller's session id>`, not a client supplied `companyId`; the one-company-per-user constraint makes this the entire ownership check, with no separate lookup-then-act step for a request to race against |
| Show rejection feedback | `rejection_reason` | `companies.rejection_reason`, set by the separate admin app, this feature only reads and displays it |

**Key invariants**:
- One `companies` row per `clerk_user_id` (existing DB constraint, name `companies_clerk_user_id_key` per Postgres's default naming for an inline `unique` column); this feature never attempts a second creation for a user who already has one, and the DB constraint is the backstop if it ever tried (mapped to `already_listed`, not a raw 500).
- A `companies` row is never created without its matching `company_contacts` row, or the reverse; both writes happen inside one Postgres function (`create_business_listing`, new), the same atomic pattern this schema already uses for `create_enquiry` and `get_or_create_buyer`: `language plpgsql`, `set search_path = ''`, no `security definer` (the caller is always `service_role` via `supabaseAdmin`, which already bypasses RLS), `revoke execute ... from public; grant execute ... to service_role;`.
- Editing is likewise atomic and ownership scoped inside its own function/query (`where clerk_user_id = ... and status in ('pending', 'rejected')`), not a check-then-act pair of separate calls; this closes the race a separate `assertOwnsCompany` read followed by an unguarded update would leave open, and is also what makes AC-6 hold at the write layer, not only in the UI.
- The logo upload always completes successfully before any database write references its URL; a failed upload creates no row and leaves no dangling reference. On an edit that replaces an existing logo, the previous Storage object is deleted best effort after the row update succeeds.
- No public read path is touched by this feature; the existing `status = 'approved'` RLS policy from spec 0001 continues to gate every public facing read, unchanged.

**Security model**: `/list-business` and both server actions require a signed in Clerk session (`auth()` checked server side; on signed out, `redirectToSignIn({ returnBackUrl: '/list-business' })`, matching the existing convention that this project checks auth per page/action rather than via route level middleware, per `proxy.ts`). Every write goes through `supabaseAdmin` from a trusted server action, never from the browser, matching the project wide rule that the browser never holds a service role key. No new RLS policy is needed for `companies` insert/update, since writes stay server route mediated (the same access model spec 0001 already chose over per user RLS). Both server actions cap attempts per `clerk_user_id` (e.g. 10 per hour, checked the same way `create_enquiry` already rate limits by buyer) so a signed in account cannot hammer the write path even though it is authenticated, not public. This feature reads and displays `rejection_reason`, a value only the separate admin app writes; no new compliance scope (no payment data, no new PII beyond the WhatsApp number this project already collects for buyers).

**Configuration required**:
- `next.config.ts`: raise `experimental.serverActions.bodySizeLimit` to `'3mb'` (the Next.js default of 1 MB can silently reject a real phone photo used as a logo). No new environment variables or credentials; reuses the existing Clerk and Supabase configuration otherwise.

**Critical test scenarios**:
- Happy path: a signed in user with no company submits the form with all required fields, lands on a status view showing `pending`, and a direct query confirms both the `companies` and `company_contacts` rows exist, verifies **AC-1**, **AC-2**
- Failure case: submitting with no logo (or no WhatsApp number) shows a field level error and creates no row in either table, verifies **AC-3**
- Failure case: the logo upload itself fails (a bad file, a Storage error) and no `companies` row is created, verifies **AC-2**, **AC-10**
- Happy path: a user with a `pending` company revisits `/list-business`, sees their submitted details pre filled, edits the location, and the row updates while `status` stays `pending`, verifies **AC-4**, **AC-5**
- Happy path: a user with a `rejected` company (with a `rejection_reason` set) revisits `/list-business`, sees the reason, edits their listing, and `status` flips back to `pending` on save, verifies **AC-4**, **AC-5**, **AC-7**
- Happy path: a user with an `approved` company revisits `/list-business` and sees a read only confirmation, with no editable fields, verifies **AC-6**
- Auth/permission: a signed out visitor hitting `/list-business` is redirected to sign in, then returned to `/list-business` afterward, verifies **AC-1**
- Auth/permission: a signed in user with an `approved` company calls `updateBusinessListing`; the write affects zero rows and returns `not_editable`, never a silent success, verifies **AC-6**, the security model
- Failure case: two concurrent submits from the same signed in user (a double click) resolve to exactly one `companies` row; the second resolves via the `23505` mapping to `already_listed`, not a duplicate row or a raw error, verifies **AC-9**
- Failure case: a WhatsApp number that passes the form's basic validation but fails the DB's stricter E.164 check surfaces as a field level error on the WhatsApp field, not a generic server error, verifies **AC-3**
- Regression: the home page's Featured Exporters section and stats strip still never show a `pending` or newly created company until an admin approves it in the separate app, verifies **AC-8**

## Build plan

1. [x] Migration: widen the `companies.status` check constraint from `('pending', 'approved')` to `('pending', 'approved', 'rejected')`; add `companies.rejection_reason text` with `check (status = 'rejected' or rejection_reason is null)`, mirroring `products.rejection_reason` exactly; apply it and regenerate `database.types.ts` in both this repo and the admin repo, per the process spec 0001 established, satisfies **AC-5**, **AC-6**, **AC-7**
2. [x] Add the `create_business_listing` Postgres function: inserts the `companies` row and its `company_contacts` row in one transaction given the validated inputs plus the caller's `clerk_user_id`, returns `table (company_id uuid, status text)`; `language plpgsql`, `set search_path = ''`, `revoke execute ... from public; grant execute ... to service_role;`, matching `create_enquiry`'s exact footer, satisfies **AC-2**, the atomicity invariant
3. [x] Add `update_business_listing`: updates the caller's own row scoped by `where clerk_user_id = p_clerk_user_id`, refusing (via raised `P0004`/`P0005`/`P0006` error codes) a missing row, an `approved` row, or a save within 10 seconds of the last one, plus a `company_contacts` upsert, in one transaction, satisfies **AC-5**, **AC-6**. Live testing against the linked database caught and fixed a real bug here: `on conflict (company_id)` was ambiguous against the function's own `company_id` return column; fixed by naming the conflict target by constraint (`on conflict on constraint company_contacts_pkey`) instead.
4. [x] Add `lib/supabase/queries/companies.ts`: `getMyCompany(clerkUserId)` (a `supabaseAdmin` read scoped to the caller's own `clerk_user_id`, since a pending/rejected row is invisible to the public `anon` RLS policy), satisfies **AC-1**, **AC-4**
5. [x] Add `lib/actions/business-listing.ts`: `submitBusinessListing` and `updateBusinessListing` server actions, zod validated (a digit count check on the WhatsApp field, tighter than `sendEnquiry`'s, since this number's normalized form must pass `company_contacts`'s stricter E.164 check), uploading the logo to `company-logos/{clerkUserId}/{uuid}.{ext}` via `supabaseAdmin.storage` before any database write, calling `create_business_listing` or `update_business_listing`, mapping a `23505` on `companies_clerk_user_id_key` to `already_listed`, a `23514` on `company_contacts.whatsapp_number` to a field level error, and `P0004`/`P0005`/`P0006` to `not_found`/`not_editable`/`rate_limited`, and calling `revalidatePath('/list-business')` on success, satisfies **AC-2**, **AC-3**, **AC-5**, **AC-6**, **AC-9**, **AC-10**
6. [x] Raise `next.config.ts`'s `experimental.serverActions.bodySizeLimit` to `'3mb'`, satisfies **AC-2**, **AC-10** (a real logo upload must not silently fail against the 1 MB default)
7. [x] Build the `/list-business` page and its form/status UI (`components/business-listing-form.tsx`): redirects a signed out visitor to sign in (`redirectToSignIn({ returnBackUrl: '/list-business' })`); calls `getMyCompany`; renders the empty form (no company), the pre filled editable form (`pending`/`rejected`, showing `rejection_reason` when present), or the read only status view (`approved`), satisfies **AC-1**, **AC-4**, **AC-5**, **AC-6**, **AC-7**
8. [x] Update the "List Your Business Free" links from `/sign-up` to `/list-business`: the hero CTA and the signup band on the home page (as named in this spec), plus a third occurrence found in the sticky header (`components/site-header.tsx`) that this spec's AC-11 didn't originally enumerate but is the same CTA and was left inconsistent otherwise, satisfies **AC-11**
9. [ ] Manual verification against every Critical test scenario above. **Partially verified, not complete** — see `verify.md` for the full evidence ledger and per AC breakdown. Done so far, including a `/check verify` pass on 2026-09-03: `create_business_listing` and `update_business_listing` tested directly against the linked database (atomic company + contact creation, both success and failure-rollback paths, the duplicate `clerk_user_id` guard, the rejected → pending resubmit with `rejection_reason` cleared, the `approved` write lock, and the rate limit, each confirmed with real queries, test rows cleaned up after); the signed out redirect confirmed live (`/list-business` → `307` → `/sign-in?redirect_url=...`); a raw anon REST query confirmed a `pending` company is invisible and the same row becomes visible once `approved`; `tsc`, `lint`, and `next build` all clean, `/list-business` correctly builds as dynamic (`ƒ`). This **fully verifies AC-5, AC-6 (write layer), AC-8, AC-9**, and **partially verifies AC-1, AC-2, AC-3, AC-10, AC-11** (the database/mechanism layer only; every browser rendered behavior these ACs also require — the empty form, a real file upload, client rendered field errors, which CTA a click actually lands on — is unverified). **AC-4 and AC-7 are not verified at all**: their behavior is routing/display logic that only a rendered page proves, and no page was rendered. None of this was exercised through the actual `/list-business` form with a real signed in Clerk user, because no browser automation tool or Clerk test user is available in this environment. This task stays unticked until that browser pass happens.
10. [x] Amendment (decided inline with the engineer after the initial build): add a required business email. Migration adds `companies.email` (nullable, backfilled for the one existing demo row, then set not null, with a format check), widens `create_business_listing`/`update_business_listing` to a `p_email` parameter (dropping the old 6 arg overloads first so they don't linger), and wires the field through `getMyCompany`, both server actions (including a `23514` on `companies_email_check` mapped to a field level error, same pattern as the WhatsApp field), the form, and the page. Re-verified live: valid email creates correctly, an invalid one fails the check and rolls back the whole write, satisfies **AC-1**, **AC-2**, **AC-3**
11. [x] Amendment (2026-09-09, following spec 0004's Cloudflare R2 build): moved the logo upload from the `company-logos` Supabase Storage bucket to R2, since spec 0004's migration revoking that bucket's public read would otherwise have broken this feature. `uploadLogo` now calls `uploadToR2("logos", key, ...)`; `deleteLogoBestEffort` now calls the new `deleteFromR2`/`parseR2Url` helpers (added to `lib/storage/r2-client.ts`/`r2.ts` for this reason, ahead of spec 0004's own original schedule). Verified live: upload, the returned URL resolving to the exact bytes, `HeadObject` confirming a real delete, and a round trip of `parseR2Url` against `uploadToR2`'s own URL shape, satisfies **AC-10**

## Consequences

**Positive**:
- Closes the real gap in the two sided marketplace: a supplier can now actually get themselves into the directory, not just be added by an admin or a seed script.
- Reuses the schema's existing shape almost entirely (one new column); no new tables, no new auth system, no new storage bucket.
- The atomic `create_business_listing` function keeps this project's "multi table write, one transaction" pattern consistent with `create_enquiry` and `get_or_create_buyer`, rather than introducing a new, weaker two step write.

**Negative / tradeoffs**:
- No notification (email or WhatsApp) tells a supplier their listing was approved or rejected; they must revisit `/list-business` themselves to find out. Accepted for this pass; see Follow up.
- An approved listing cannot be self edited in this pass; a supplier who needs to fix something after approval has no in app path yet.
- If the logo upload succeeds but the following database write fails for an unrelated reason (a new listing only; an edit's previous logo is cleaned up on success, per the key invariants), the uploaded file is not cleaned up automatically. Low likelihood, low cost (an orphaned file in a bucket), accepted rather than adding compensating cleanup logic for a rare case.

**Neutral**:
- `/list-business` deliberately serves three different views (empty form, editable form, read only status) from one route rather than three separate pages, since they are really one state machine viewed at different states.
- Product submission (feature 10's other half) is not designed or built here; it becomes its own spec once an approved company exists to build and test it against.

## Follow-up

- [ ] Design and build product submission (feature 10's other half) once this ships and a real approved company exists to test against; gate it on `companies.status = 'approved'`.
- [ ] Consider notifying a supplier (email, or a WhatsApp message once that integration exists) when their listing is approved or rejected, instead of requiring them to check `/list-business` themselves.
- [ ] Decide whether an approved company should ever be self editable, and if so, whether an edit should re-enter review (back to `pending`) or apply immediately.
- [ ] Confirm the separate admin app's approve/reject action sets and clears `rejection_reason` consistently with this new column.

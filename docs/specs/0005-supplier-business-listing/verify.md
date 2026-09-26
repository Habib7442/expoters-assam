# Verify: supplier business listing · spec 0005 · updated 2026-09-03

_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

`/check verify` (2026-09-03): every DB layer and routing behavior below was exercised fresh against the linked database with cited evidence. Every step needing a real signed in browser session is unticked and BLOCKED: no browser automation tool and no Clerk test user/testing token are available in this environment. See the report for the full evidence ledger.

`/check verify` (2026-09-26): the blocked browser steps were run with Playwright as a real signed in supplier (a throwaway Clerk development user signed in with `@clerk/testing`, deleted afterwards along with its company, contact, products and R2 images). Evidence: 8 field errors with nothing saved on an empty submit; a real logo upload to `logos/<clerkUserId>/…`; the row `pending`, `submitted_by = supplier`, consent recorded, WhatsApp normalized to `+91…`; hidden from anon and `/companies/<slug>` 404 while pending; pre filled form on return; edit while pending saved; rejection reason shown, and the fix returned it to `pending` with the reason cleared; approved shows "Your business is live" plus the edit form; signed out `/list-business` redirects to `/sign-in`.

## UI / manual

Genuine browser/HTTP level observations only. A checkbox here means the rendered page or a real HTTP request was actually driven, not that an equivalent database check passed — see Database below for that evidence.

- [x] Sign out, visit `/list-business` → redirected to `/sign-in?redirect_url=...list-business` → AC-1 (browser sign in + landing back not exercised, blocked)
- [x] Sign in as a Clerk user with no company → the empty listing form renders (name, location, business email, WhatsApp number, logo required, about optional) → AC-1 — BLOCKED, no browser session
- [x] Submit the form through the actual browser (a real name, location, logo file upload, business email, WhatsApp number) → lands on the pending status view → AC-2 — BLOCKED, no browser session (the write itself is proven atomic at the database layer, see Database)
- [x] Submit with a missing name, location, logo, email, or WhatsApp number → a field level error appears under the right field → AC-3 — BLOCKED (client side zod validation only exercised by code reading, not a live submission)
- [x] Revisit `/list-business` as the same user (now `pending`) → sees the pre filled editable form → AC-4 — BLOCKED, no browser session
- [x] Edit and save while `pending`/`rejected`, through the browser → the row updates and a `rejected` listing's form shows cleared → AC-5 — BLOCKED, no browser session (the write itself is proven at the database layer, see Database)
- [x] Rejection reason shown in the UI → AC-7 — BLOCKED, no browser session (the data path `getMyCompany` → `rejectionReason` prop is code reviewed, not runtime observed)
- [x] Attempt to edit an `approved` company through the browser → sees "Your business is live" plus the edit form that sends it back to review (AC-6 as amended 2026-09-26) → AC-6 — BLOCKED, no browser session (the write layer's own refusal is proven at the database layer, see Database)
- [x] Click "List Your Business Free" from the hero and the signup band → both render `href="/list-business"` in the fetched HTML → AC-11. The sticky header's third CTA is a Clerk `<Show>` client component that renders nothing in a no JS fetch; confirmed via source instead (`components/site-header.tsx:82`, `href="/list-business"`), not runtime observed

## Database

Exercised directly against the linked database — RPC calls or a raw anon REST query, never through the browser form. This proves the write/read layer works, not that the rendered UI correctly drives it (see UI / manual above for what's still blocked on a real browser session).

- [x] `create_business_listing` with a name, location, a logo URL, a valid business email, and a valid WhatsApp number → one `companies` row (`status='pending'`, `submitted_by='supplier'`, `clerk_user_id` set, `country='India'`, `email` set) and one `company_contacts` row with the normalized number, confirmed by query → AC-2 (the write layer's atomicity)
- [x] `create_business_listing` with an invalid business email → fails with `23514` on `companies_email_check`, and the whole write rolls back (`count = 0` confirmed after) → AC-3
- [x] `create_business_listing` with a WhatsApp number that fails the DB's format check (`'notaphonenumber'`) → fails with `23514` on `company_contacts_whatsapp_number_check`, and the earlier `companies` insert rolls back (`count = 0` confirmed after) → AC-3, plus the atomicity invariant on a failure path
- [x] `update_business_listing` while `pending`/`rejected` → row updates, `rejected` → `status` flips to `pending` and `rejection_reason` clears, confirmed by query before/after → AC-5
- [x] Two `update_business_listing` calls back to back → the second fails with `P0006: rate_limited` → security model (`update_business_listing`'s cooldown only; `create_business_listing`/`submitBusinessListing` has no rate limit of its own, see index.md's Security model)
- [x] `update_business_listing` against an `approved` row → fails with `P0005: not_editable`, row unchanged → AC-6 (the write layer's refusal; the read only UI view itself is separately blocked, see UI / manual)
- [x] A second `create_business_listing` call for the same account → fails with `23505` on `companies_clerk_user_id_key` → AC-9
- [x] A raw anon REST query (`GET /rest/v1/companies?name=eq....`) while the test company is `pending` → returns `[]`; the same query after flipping the row to `approved` → returns it → AC-8, both the hidden and visible states proven, not assumed

## Commands

- [x] `npx tsc --noEmit` → no errors
- [x] `npm run lint` → no errors
- [x] `npm run build` → succeeds; `/list-business` shows as `ƒ` (dynamic) in the route table

(The two RPC checks previously duplicated here — the `23505` duplicate-listing guard and `update_business_listing` against an `approved` row — now live once, under Database, since that's what they actually are.)

## Acceptance-criteria coverage

- AC-1 … signed out redirect MET (live). Empty form render for a new user BLOCKED (no browser session)
- AC-2 … atomic create MET (live, both the success path and the rollback-on-failure path). Real browser triggered upload BLOCKED
- AC-3 … DB format check MET (live, `23514`). Client side field errors BLOCKED (no browser)
- AC-4 … status routing logic exists in code; rendered view BLOCKED (no browser session)
- AC-5 … MET (live): edit while pending, and the rejected → pending transition with `rejection_reason` cleared
- AC-6 … MET (live): the write layer refuses an edit to an `approved` row (`P0005`); the read only UI view itself BLOCKED
- AC-7 … rejection reason display: code path exists; rendered view BLOCKED (no browser session)
- AC-8 … MET (live): a pending row is invisible to an anon REST query; the same row is visible once approved
- AC-9 … MET (live): the `23505` guard
- AC-10 … MET by code review (every write goes through `supabaseAdmin` server side; no browser side Storage write exists in the code); the real file upload itself BLOCKED
- AC-11 … MET for 2 of 3 CTAs by rendered HTML; the 3rd MET by source reading only, not runtime rendered evidence (Clerk `<Show>` needs client JS)

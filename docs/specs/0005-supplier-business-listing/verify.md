# Verify: supplier business listing · spec 0005 · updated 2026-09-03

_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

`/check verify` (2026-09-03): every DB layer and routing behavior below was exercised fresh against the linked database with cited evidence. Every step needing a real signed in browser session is unticked and BLOCKED: no browser automation tool and no Clerk test user/testing token are available in this environment. See the report for the full evidence ledger.

## UI / manual

- [x] Sign out, visit `/list-business` → redirected to `/sign-in?redirect_url=...list-business` → AC-1 (browser sign in + landing back not exercised, blocked)
- [ ] Sign in as a Clerk user with no company → the empty listing form renders (name, location, business email, WhatsApp number, logo required, about optional) → AC-1 — BLOCKED, no browser session
- [x] Submit the form with a name, location, a logo URL, a valid business email, and a valid WhatsApp number → **exercised directly via `create_business_listing`, not through the browser form**: one `companies` row (`status='pending'`, `submitted_by='supplier'`, `clerk_user_id` set, `country='India'`, `email` set) and one `company_contacts` row with the normalized number, confirmed by query → AC-2 (the browser triggered path, including a real file upload, not exercised, blocked)
- [ ] Submit with a missing name, location, logo, email, or WhatsApp number → a field level error appears under the right field → AC-3 — BLOCKED (client side zod validation only exercised by code reading, not a live submission)
- [x] Submit with an invalid business email (fails the DB format check) → **exercised directly**: `create_business_listing` with `'not-an-email'` fails with `23514` on `companies_email_check`, and the whole write rolls back (`count = 0` confirmed after) → AC-3
- [x] Submit with a WhatsApp number that fails the DB's format check → **exercised directly via `create_business_listing`** with `'notaphonenumber'`: fails with `23514` on `company_contacts_whatsapp_number_check`, and the earlier `companies` insert rolls back (`count = 0` confirmed after) → AC-3, plus the atomicity invariant on a failure path
- [ ] Revisit `/list-business` as the same user (now `pending`) → sees the pre filled editable form → AC-4 — BLOCKED, no browser session
- [x] Edit and save while `pending`/`rejected` → **exercised directly via `update_business_listing`**: row updates, `rejected` → `status` flips to `pending` and `rejection_reason` clears, confirmed by query before/after → AC-5
- [ ] Rejection reason shown in the UI → AC-7 — BLOCKED, no browser session (the data path `getMyCompany` → `rejectionReason` prop is code reviewed, not runtime observed)
- [x] Save two edits back to back → **exercised directly**: the second `update_business_listing` call within the same round trip fails with `P0006: rate_limited` → security model
- [x] Attempt to edit an `approved` company → **exercised directly**: `update_business_listing` fails with `P0005: not_editable`, row unchanged → AC-6 (the read only UI view itself not rendered, blocked)
- [x] Attempt a second listing for the same account → **exercised directly**: second `create_business_listing` call fails with `23505` on `companies_clerk_user_id_key` → AC-9
- [x] Check the home page's public read path while the test company is `pending` → a raw anon REST query (`GET /rest/v1/companies?name=eq....`) returns `[]`; the same query after flipping the row to `approved` returns it → AC-8, both the hidden and visible states proven, not assumed
- [x] Click "List Your Business Free" from the hero and the signup band → both render `href="/list-business"` in the fetched HTML → AC-11. The sticky header's third CTA is a Clerk `<Show>` client component that renders nothing in a no JS fetch; confirmed via source instead (`components/site-header.tsx:82`, `href="/list-business"`), not runtime observed

## Commands

- [x] `npx tsc --noEmit` → no errors
- [x] `npm run lint` → no errors
- [x] `npm run build` → succeeds; `/list-business` shows as `ƒ` (dynamic) in the route table
- [x] Direct RPC check: `create_business_listing` called twice with the same `p_clerk_user_id` → second call fails with `23505` on `companies_clerk_user_id_key`
- [x] Direct RPC check: `update_business_listing` against a row with `status='approved'` → fails with `P0005`

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

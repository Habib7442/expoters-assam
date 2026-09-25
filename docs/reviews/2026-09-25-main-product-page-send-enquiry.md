# Review, main, 2026-09-25

**Reviewed by**: Claude Sonnet 5 (author on Claude Sonnet 5)
**Scope**: 7 files, feature review at HEAD (spec 0003, scope feature 4) plus 3 uncommitted test files
**Verdict**: Changes requested → both Majors resolved in `c7595a0`; no open merge blockers
**Follow-up (2026-09-25)**: The two Major findings below are kept for the record and marked **Resolved**. The Minor finding and the nits were not part of that fix and are still open.

## Summary

This is the buyer-facing core loop: an approved product's page, the Send Enquiry dialog, the `sendEnquiry` server action, and the `create_enquiry`/`create_company_enquiry` database functions that do the rate limiting, deduplication, approval check, and WhatsApp number lookup in one transaction. The security model is solid and independently verified: `company_contacts` is structurally unreadable by `anon`/`authenticated` (RLS with no policy plus an explicit revoke), every write goes through a `service_role`-only RPC, the approval check lives in the database rather than the application layer, and concurrent requests from the same buyer are correctly serialized with an advisory lock. Test coverage for the action and the query layer is thorough and AC-mapped. Two issues should be fixed before merge: database errors other than `product_not_found` are swallowed with no server-side log line anywhere in the codebase, breaking the "no lead is ever silently lost" goal for exactly the failures that would need diagnosis; and React's automatic form reset after every form action clears the name/phone/email/message/consent fields on any rejected submission, not just the rate-limited case verify.md called out, forcing buyers to retype everything to fix something as small as a phone number typo.

## Major

### 🟠 Database errors from `create_enquiry`/`create_company_enquiry` are never logged, `lib/actions/send-enquiry.ts:96-118`
**Problem**: When the RPC returns any error other than `P0002` (e.g. a `23514` check-constraint violation from `buyers_phone_check` when the loose phone regex lets through a string that the DB's normalization can't turn into a valid number, a `42501` permission error if a future migration mis-grants `service_role`, or any transient Postgres/network failure), the code returns a generic `server_error` to the caller and does nothing else. The same is true when `data?.[0]` is empty. No `console.error`, no structured log, nothing.
**Why it matters**: Every other Supabase query helper in this codebase (`lib/supabase/queries/products.ts:58`, `home.ts`, `companies.ts:95`) logs `"<fnName> failed", error` on exactly this kind of failure; `send-enquiry.ts` is the one outlier. Per the spec's own user story, "every enquiry [should be] recorded even if the buyer never completes the WhatsApp step, so no lead is ever silently lost" — but a genuinely lost write here (the one case that most needs a paper trail) leaves zero signal in the logs. A buyer sees "something went wrong," and there is no way for the team to know it happened, let alone why, short of the buyer complaining. This is also the code path a slightly-too-permissive phone regex (`/^[0-9+\-\s()]{10,20}$/`, documented in the spec as deliberately not validating) is most likely to hit.
**Suggested fix**: Log on both the `if (error)` and `if (!row)` branches, the way the rest of the codebase already does (`console.error("sendEnquiry failed", { code: error.code, message: error.message, targetType: parsed.data.targetType })`). Log the error code/message only, not the full Postgres error object — a unique-violation `DETAIL` can echo back the offending value (e.g. a phone number), and buyer PII must not land in logs per AGENTS.md.
**Resolved** (`c7595a0`): `lib/actions/send-enquiry.ts:105` logs `{ code, message }` only (no full error object, so no `DETAIL` PII) on the RPC error branch, and `:115` logs the no-row branch.

### 🟠 Any rejected submission clears the buyer's typed name, phone, email, message and consent, `components/send-enquiry-dialog.tsx:47-67,115`
**Problem**: The form's inputs are uncontrolled and the form's `action` is wired directly to `handleSubmit` (`<form action={handleSubmit} ...>`, line 115). React 19 automatically resets an uncontrolled form's fields once the action function returns, regardless of whether the *business* result was success or failure — only a thrown exception would suppress it, and `handleSubmit` never throws. So a validation error (a malformed phone), a `rate_limited` rejection, a `bot_check_failed`, or a `not_found` all silently wipe every field the buyer just typed, not only the rate-limited case verify.md's manual run happened to notice.
**Why it matters**: The spec's own design intent (Build plan step 6) was for the form to reset "on reopen" after a successful close, not after a failed attempt — the point of showing a field-level error (`aria-invalid`, the red text under the phone input) is so the buyer can see and fix what they typed, not retype the whole form from scratch. For the one page this entire spec exists to prove out, losing a buyer's name and message because they mistyped a phone number is a real, avoidable drop-off in the core conversion loop.
**Suggested fix**: Keep the values across a failed submission — either make the inputs controlled and repopulate them from state after a non-ok result, or call the DOM form's own reset only in the success branch (e.g. via a form ref, only when `result.ok` is true) instead of relying on React's blanket post-action reset. Confirm the fix manually in a real browser; the project's vitest setup has no DOM/Testing Library, so this class of bug cannot be caught by the current test suite (noted below, not a new gap to add tests for per this review's test-signal guidance).
**Resolved** (`c7595a0`): `components/send-enquiry-dialog.tsx:121` now uses `<form onSubmit={handleSubmit}>` with `event.preventDefault()`, not `<form action={fn}>`, so React no longer resets the fields after a rejected submission.

## Minor

### 🟡 Type-lying casts hide a real nullable/string mismatch, `lib/actions/send-enquiry.ts:82,84,90,93`
**Problem**: `p_email: (email || null) as string` and `p_message: (message || null) as string` (both branches) cast a `string | null` expression to `string`. The generated Supabase types (`database.types.ts:586-587,600-601`) type these RPC args as plain `string`, so without the cast TypeScript would correctly flag passing `null`. The cast silences that instead of reflecting reality.
**Why it matters**: It works today only because Postgres happily accepts `null` for a `text` parameter with no `not null` at the call boundary, and the function body defends with `coalesce`/`nullif`. But the cast means a future edit to either value (e.g. `p_email.trim()` added at the call site) would compile cleanly and crash at runtime on a null email, with nothing in the types to warn the next person.
**Suggested fix**: Type these two RPC args as `string | null` at the call site (or regenerate/patch the local arg type) instead of casting past the mismatch.

## Nits

- ⚪ `components/consent-checkbox.tsx:20-26,42`, the error paragraph isn't wired to the checkbox via `aria-describedby`, so a screen reader won't associate the "Please agree to the Privacy Policy…" message with the input it belongs to.
- ⚪ `lib/supabase/queries/products.ts:115-117` and `app/products/[slug]/page.tsx:39-40`, the R2-origin filter on gallery/cover images is applied once in the query layer and again in the page; harmless given today's data shape, but worth collapsing to one place if it's touched again.

## Strengths

- The `company_contacts` security model (RLS with no policy plus an explicit `revoke select`, `service_role`-only RPC execute grants tightened again in `20260925030000` after a real gap was found) is defense-in-depth done right, and AC-6 was independently verified live against a raw anon key.
- `create_enquiry`/`create_company_enquiry` correctly serialize concurrent requests from the same buyer with a per-buyer advisory lock before the rate-limit count, and verify.md confirms this live under real concurrency (6 simultaneous calls from one phone produced exactly 5 rows).
- The test suite for `sendEnquiry` is well targeted at real risk, not just happy paths: bot-check ordering before validation, PII not leaking into a generic server-error message, P0002 mapped correctly for both product and company targets, and a SQL-injection-shaped `productId` rejected before the database is ever called.

## Test coverage

`lib/actions/send-enquiry.test.ts` and `lib/supabase/queries/products.test.ts` cover the action and query layer well: input validation, the bot-check gate (including fail-open on `unavailable`), the wa.me URL construction and encoding, rate-limit and dedup mapping, P0002 handling for both target types, and the R2-domain image filtering including the null-logo/null-category edge cases. `app/products/[slug]/page.test.ts` covers the 404 path, the metadata title/description/truncation/fallback, and that `getCurrentTier` is only called for a product that actually renders.

Two things new logic touches that are not, and per this review's test signal should be, covered:
- The silent database-error path (Major above) has no test asserting a log call, because there is no log call to assert.
- `components/send-enquiry-dialog.tsx`'s client-side branching (the automatic form-reset behavior, the turnstile-reset-on-failure wiring, the success-panel gating on `whatsappUrl`) is untestable with the project's current vitest setup (node environment, no Testing Library/DOM), so the form-reset bug above was only catchable by the manual verification pass that did in fact catch a version of it. This isn't a gap to close with more unit tests under the current setup; it's a reason the manual `/check verify` pass matters here and should specifically try a validation-error retry (not just the rate-limited case) before this ships.

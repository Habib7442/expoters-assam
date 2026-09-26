# Review, main, 2026-09-26

**Reviewed by**: Claude Fable 5.1 (author on another model)
**Scope**: 16 files, feature review at HEAD (scope feature 8, Post Buy Requirement, decided inline, no spec) plus the uncommitted extension of `lib/actions/post-buy-requirement.test.ts` and the new `app/buy-requirements/page.test.ts`
**Verdict**: Changes requested
**Follow up (2026-09-26)**: the major finding and 4 of the 5 minor findings were fixed after review (marked **Resolved** below). Also fixed from the nits: "Post RFQ" now prefills the product, not the category title.

## Summary

A visitor posts what they want to buy through `BuyRequirementForm`, the `postBuyRequirement` server action checks Turnstile, validates with zod and writes through the service role only `create_buy_requirement` RPC, which resolves the buyer by phone, caps posts at 3 an hour, refuses a blank consent version and records it. The buyer is then handed a wa.me link to the platform number. The data side is solid: the rate limit is race free, public visibility and PII are enforced by the database (RLS on `is_public` plus column grants), consent cannot be skipped by any caller of the RPC, and the retention job purges rows after 12 months as the Privacy Policy promises. The one real problem is the `/buy-requirements` page copy, which promises buyers direct WhatsApp quotes from verified exporters with no middleman, lab reports and sample offers. None of that exists, and the reply flow the engineer decided today routes through the platform team, the opposite of "no middleman". The rest are smaller: silent database errors, a phone check the database can still reject, raw palette colors, and an "Active" list with no age limit.

## Major

### 🟠 The listing page promises a reply flow the product does not have, `app/buy-requirements/page.tsx:52`
**Problem**: The page tells buyers things the product does not do, and some of them contradict the decision recorded in scope feature 9:
- Step 02 (line 63 to 65): "Verified Exporters Review ... inspect your RFQ to prepare competitive wholesale quotes." Exporters can only see public posts, the public box is unticked by default (the correct DPDP choice), so most posts are seen by no exporter at all. Nothing asks for or checks that a reader is a verified exporter.
- Step 03 (line 71 to 73): "Receive detailed pricing, lab test reports, and sample offers directly on your WhatsApp with zero middleman fees." There is no way for a supplier to reply to a requirement today (feature 9's buy requirement half is unbuilt), and the decided flow sends the reply to the platform number so the client's team introduces the two sides. That is a middleman, just a free one. Lab reports and samples are not a platform feature.
- Hero (line 128 to 129): "exporters ... connect directly via WhatsApp to submit bids". The buyer's phone is never shown, so no exporter can connect directly.
- Badges and empty state (lines 135, 291 to 292, 314 to 315, 328 to 329): "Direct WhatsApp Quotes", "receive verified quotations directly on WhatsApp from registered Assam exporters", "Hear back from sellers instantly", "Deal directly without middleman".
- Step 01 (line 57) lists "target grade, destination port, and packaging specifications", which the form does not have (only a free text Notes field).

**Why it matters**: This is the page a buyer reads before posting, and the success screen then says only "Continue on WhatsApp to hear back fastest" to the platform number. A buyer who expects exporter quotes "instantly" and "directly" gets a message thread with the client's team, or nothing if they left the post private. For a B2B platform whose whole value is trust, over promising on the first interaction is a credibility and complaint risk, and "zero middleman" is plainly false against the decided flow. Verify passed because it tested behavior, not claims.
**Suggested fix**: Rewrite the copy to match the real flow: post your need, the Exporters Assam team (and, if public, suppliers browsing the board) sees it, suppliers reply through the platform and the team introduces you on WhatsApp, free for buyers. Drop "lab test reports", "sample offers", "instantly", "directly" and "zero middleman", and trim step 01 to the fields the form actually has. Say near the form's public checkbox that private posts are seen only by the Exporters Assam team. Worth having the client sign off the wording since it is a product promise.
**Resolved**: the copy now describes the real flow. Buyers post and choose public or private, the team reads every requirement and matches it with exporters, and the introduction happens on WhatsApp with the deal agreed directly and no commission. The claims about lab test reports, certified producers, instant replies, direct supplier quotes and zero platform fees are gone, and so is the mention of form fields that don't exist. The metadata description was updated too. A test guards against the old claims coming back. The client should still read and approve the wording.

## Minor

### 🟡 Database failures are returned but never logged, `lib/actions/post-buy-requirement.ts:78`
**Problem**: Both server error paths (the RPC `error` at line 78 and the empty result at line 95) return the generic message without logging anything. `sendEnquiry` logs the code and message at the same points (`lib/actions/send-enquiry.ts:105` and `:115`).
**Why it matters**: A broken RPC signature, a check constraint failure or a missing grant after a migration would show every buyer "Something went wrong" while the server logs stay empty. Losing buyer leads silently is the failure this project most wants to avoid.
**Suggested fix**: Log `{ code, message }` (never the input, which holds name, phone and email) the same way `sendEnquiry` does, and assert the log call in the existing server error test.
**Resolved**: both server error paths log `{ code, message }` (or "no row") and never the buyer's details. A test checks this.

### 🟡 The phone check accepts numbers the database then rejects, `lib/actions/post-buy-requirement.ts:11`
**Problem**: The zod regex allows 10 to 20 characters of digits, spaces, `+`, `-` and brackets, so `+1 234 567 89` (9 digits) or `(((((())))))` (no digits) pass. `normalize_buyer_phone` then produces a value that fails `buyers_phone_check`, the RPC raises 23514, and the buyer sees "Something went wrong on our end" instead of "Enter a valid phone number". `business-listing.ts:24` already counts digits (10 to 15) for exactly this reason.
**Why it matters**: A typo in the most important field looks like a site outage, the buyer has no hint what to fix, and (with the finding above) nobody sees it in the logs either.
**Suggested fix**: Add the same digit count refinement used in `business-listing.ts`, ideally as one shared helper used by both anonymous forms, and add a test with a 9 digit number.
**Resolved**: the phone rule now also counts digits (10 to 15). The same fix went into `send-enquiry.ts`, which had the identical rule. Both have tests.

### 🟡 Raw Tailwind palette colors instead of tokens, `app/buy-requirements/page.tsx:59`
**Problem**: The page uses `emerald-*`, `teal-*`, `amber-*`, `bg-white`, `to-white`, `text-white` and `dark:` variants in 19 places (lines 59, 67, 75, 115, 118, 119, 133 to 143, 197, 198, 277, 280, 311, 318, 325, 426). This is the same issue the home page review fixed in `site-header.tsx`.
**Why it matters**: AGENTS.md and spec 0002 AC-3 require colors from the tokens in `app/globals.css`. The site never enables dark mode, so the `dark:` classes are dead code, and a brand token change leaves this page out of step.
**Suggested fix**: Map to the existing tokens (`green`, `green-deep`, `green-wash`, `gold`, `leaf`, `background`, `card`, `primary-foreground`) as was done for the header.
**Resolved**: every emerald, teal, amber, white and `dark:` class on the page now uses a token, the same mapping as the header.

### 🟡 "Active Requirements" has no age limit and a silent cap of 100, `app/buy-requirements/page.tsx:108`
**Problem**: `getLatestBuyRequirements(100, q)` returns every public post up to the 12 month retention cutoff, and the heading prints the returned length. A post from eleven months ago is shown as "Active", and once there are more than 100 the heading says "(100)" with no pagination or hint that more exist.
**Why it matters**: Suppliers will chase stale leads, and the count reads as a total when it is a cap. Not urgent at today's volume.
**Suggested fix**: Decide a display window (for example 60 or 90 days) and filter on `created_at` in the query, or label the heading "Latest" rather than "Active". Add pagination or a "showing the latest 100" note when the cap is hit.
**Resolved**: the heading is now "Recent Requirements", and when the list reaches 100 it says "Showing the 100 most recent". Pagination is left for later.

### 🟡 `BuyRequirementForm` has no test, `components/buy-requirement-form.tsx:38`
**Problem**: The form's own logic is untested: mapping `isPublic` and `consent` from `"on"`, resetting the Turnstile token after any failed attempt, keeping typed values on a validation error, and the success view with and without a WhatsApp link.
**Why it matters**: The token reset is security relevant (a reused token is refused, spec 0006 AC-2), and the "keep values on error" behavior is exactly the kind of thing a refactor to `<form action>` would silently break, as the comment in the file explains.
**Suggested fix**: A component test that mocks `postBuyRequirement` and the widget handle, covering those four cases.
**Open**: there is no component test runner (Testing Library isn't installed). The form's behavior was proven in a real browser during `/check verify`: values are kept on error, the token resets, and the success view shows with the link.

## Nits

- ⚪ `supabase/migrations/20260925020000_add_personal_data_retention_job.sql:37`, the comment says the 1 day floor stops the buyer purge racing a write, but that only covers new buyers. A returning buyer (older than a day, all rows expired) who posts during the 02:00 IST run can make the buyer delete trip the `on delete restrict` foreign key, which aborts the whole purge for that night. Rare and self healing the next night; worth a comment, or catching `foreign_key_violation` per buyer.
- ⚪ `lib/actions/post-buy-requirement.ts:68`, `(email || null) as string` (and the same for category, location, notes) tells TypeScript a null is a string. Fine at runtime; a typed args object or regenerated types with nullable args would keep the checker honest.
- ⚪ `supabase/migrations/20260925010000_record_dpdp_consent.sql:31`, consent is enforced by the only write path (the RPC), but the table itself still accepts a new row with null consent. A `check (consent_notice_version is not null) not valid` constraint would make it hold for any future writer without touching legacy rows.
- ⚪ `supabase/migrations/20260909050000_add_create_buy_requirement.sql:37`, the per phone cap can be spent by someone else using a victim's number, and `get_or_create_buyer` keeps the first email ever given for a phone. Same inherited pattern as enquiries, and Turnstile is the real guard; noting it so the feature 9 reply flow does not trust `buyers.email` as the buyer's own.
- ⚪ `app/buy-requirements/page.tsx:407`, "Post RFQ" prefills the product field with the category title ("Agarwood & Pure Oud"), which then becomes the public headline unless the buyer edits it.
- ⚪ `components/buy-requirement-form.tsx:66`, the success view has no "post another requirement" action; the buyer has to reload.

## Strengths

- The rate limit is race free: `get_or_create_buyer`'s `on conflict do update` row lock plus the advisory lock on the buyer id serialize concurrent posts from the same phone, and the count runs after the lock under read committed, so a fourth post in the same instant cannot slip through. Verify proved the cap live.
- Both the public flag and the PII boundary live in the database, not just the form: RLS allows anon to read only `is_public = true` rows, and the column grant in `20260910020000` excludes `contact_name`, `contact_email` and `buyer_id`, so even a direct REST call with the anon key cannot reach them. The WhatsApp message carries only the product, quantity and location, and a test pins that.
- Consent is enforced at the RPC (`P0009` on a blank version), the consent less overloads were dropped after the new code shipped, and every create RPC is locked to `service_role`. The public checkbox now defaults off in both the form and the table.
- The foreign key mapping turns a deleted or forged category into a field error rather than a server error, with a test that other foreign key failures still count as server errors.

## Test coverage

`post-buy-requirement.test.ts` now covers the bot check (failed and fail open), consent, every field validation error, the exact RPC arguments including the consent version and nulls for blanks, the wa.me URL with and without location, the missing platform number, the absence of the buyer's own details in the message, the rate limit, and both server error shapes. `app/buy-requirements/page.test.ts` covers the fetch arguments, listing and count, the load failure state with retry, and both empty states. All 30 tests across these two files and `turnstile.test.ts` pass (run during this review). Not covered: logging on the server error paths (there is none), a phone with too few digits, the form component, and the SQL itself (rate limit, consent refusal, RLS and grants), which rests on the live `/check verify` run.

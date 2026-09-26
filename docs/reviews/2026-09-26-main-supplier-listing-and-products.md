# Review, main, 2026-09-26

**Reviewed by**: Claude Fable 5.1 (author on another model)
**Scope**: 22 files, feature review at HEAD of scope feature 10 (supplier business listing, spec 0005) and scope feature 16 (supplier product submission, decided inline), reviewed together as the supplier self service flow, plus uncommitted changes to `lib/actions/business-listing.test.ts` and the new `lib/actions/submit-product.test.ts`. Migrations read: `20260911010000`, `20260911050000`, `20260911070000`, `20260911080000`, `20260925010000`, `20260925030000`, `20260925040000`, `20260925050000`, `20260925060000`.
**Verdict**: Blocked
**Follow up (2026-09-26)**: the blocker, both majors and 6 of the 7 minors were fixed after review (marked below). The one left is partly resolved on purpose.

## Summary

A signed in supplier creates one pending company through `create_business_listing`, edits it through `update_business_listing` (any save, including on an approved listing, sends it back to pending), and once approved submits products through `create_product_submission`, which stores them pending with a per company cap of 30 an hour. The security model is sound: every write is keyed on the Clerk session's user id and never on a client supplied company id, the RPCs are callable only by `service_role`, business email, address, GST and WhatsApp number are all outside the anon column grants, and every upload is decoded and re encoded by sharp before it reaches R2. The blocker is a size mismatch: the product form promises up to five 2 MB images, but server actions accept 3 MB per request (and Vercel caps request bodies at 4.5 MB), so ordinary submissions of two or three photos fail with an unhandled exception. The two majors are that the business listing actions upload the logo before any ownership or cooldown check and never clean it up, which turns every failed call into an orphaned R2 object with no bound, and that an approved supplier's edit (even a save with no changes) silently takes the whole business, all its products and its enquiry path offline, which the page copy understates.

## Blockers

### 🔴 Product submission cannot carry what the form promises, `components/product-submission-form.tsx:132` and `next.config.ts:24`
**Problem**: The form and `submitProduct` allow up to 5 images at up to 2 MB each (10 MB), all sent in one server action request. `experimental.serverActions.bodySizeLimit` is `"3mb"`, sized in spec 0005 for a single logo. Per `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`, the limit applies to the raw multipart body, so two 1.6 MB photos already exceed it. Raising the limit alone will not fix production either: Vercel rejects function request bodies over 4.5 MB.
**Why it matters**: The request is refused before `submitProduct` runs, so none of its friendly error mapping applies. `await submitProduct(...)` rejects inside `startTransition`, the error propagates to the nearest error boundary, and there is no `app/error.tsx`, so the supplier gets the default "Application error" screen and loses everything they typed. Verify passed only because its two test images were small. Most real product photos under 2 MB each will add up past 3 MB by the second or third image.
**Suggested fix**: Pick one: send images one per request (upload each through its own action or a presigned R2 PUT, then submit the list of keys, validated as belonging to the caller's `{clerkUserId}/` prefix), or shrink images in the browser before sending and cap the total below the limit. In either case make the stated limits match what the transport can carry, catch a rejected action in the form and show a message instead of crashing, and add an `app/error.tsx` so any future thrown action degrades gracefully.
**Resolved**: photos are shrunk in the browser before sending (`lib/shrink-image.ts`: at most 1600px, JPEG), there is a total size check with a friendly field error, the submit is wrapped in try/catch so a failure shows in the form, `bodySizeLimit` is 4 MB (under Vercel's 4.5 MB cap), and a site wide `app/error.tsx` replaces Next's bare error page. Proven live: three 9.4 MB photos submitted fine, and the product was saved `pending` with 3 images.

## Major

### 🟠 Logo uploads happen before any ownership or cooldown check and are never cleaned up on failure, `lib/actions/business-listing.ts:196` and `lib/actions/business-listing.ts:288`
**Problem**: `submitBusinessListing` uploads the logo to R2 and only then calls `create_business_listing`. Every error branch after that (`already_listed`, the WhatsApp and email check violations, `server_error`, an empty result) returns without deleting the object. `updateBusinessListing` has the same shape: it uploads the new logo, then the RPC can return `P0006` (the 10 second cooldown), `P0004`, a check violation or a generic error, and none of those delete it. This confirms the main agent's observation; `submitProduct` tracks its keys and cleans up on every RPC failure, and these two actions do not.
**Why it matters**: The orphan is not only an occasional leftover. A signed in user who already has a listing can call `submitBusinessListing` in a loop: each call uploads up to 2 MB to R2 and then fails on the unique `clerk_user_id` constraint, so there is no rate limit anywhere on that path. The same holds for `updateBusinessListing`, because the upload happens before the cooldown is checked, so the cooldown bounds database writes but not R2 writes. Spec 0005 accepted an orphan as "a low cost tradeoff" for a replaced logo, not an unbounded write loop.
**Suggested fix**: Mirror `submitProduct`. In `submitBusinessListing`, look up the caller's company first and return `already_listed` before reading or uploading the file. In `updateBusinessListing`, check `updated_at` against the cooldown (and that the row exists) before uploading, keeping the RPC's own checks as the authority. Then call `deleteLogoBestEffort(logoUrl)` on every failure after an upload in both actions, and add tests for it like the ones in `submit-product.test.ts`.
**Resolved**: create now refuses an existing listing before uploading; update checks the 10 second cooldown before uploading and fails on a lookup error; both delete the new logo whenever the database write fails. Tests cover each path.

### 🟠 An approved supplier's edit unpublishes the business, all its products and enquiries, even with no change, `supabase/migrations/20260911070000_add_business_listing_address_and_postal_code.sql:625` and `app/list-business/page.tsx:61`
**Problem**: `update_business_listing` sets `status = 'pending'` on every save, with no comparison to the stored values. Once the company is pending, every public read path hides it (RLS on `companies`), every product of that company disappears too because product reads use `companies!inner` (the verify notes confirm "its approved products go hidden"), and `create_enquiry` and `create_company_enquiry` refuse the company. The page tells an approved supplier only that the listing "may be temporarily hidden from the public directory". To answer the question asked for this review: no field can be changed without re approval (WhatsApp number included, since it is saved in the same call), so there is no bypass, but the price of that is that product listings are affected by every edit.
**Why it matters**: The AC-6 amendment is a recorded decision and is not in question here. What looks unconsidered is the size of its consequence: fixing a typo in the "about" text, or pressing "Save changes" without editing anything, takes every product offline and stops all enquiries until an admin gets to it, with no expected turnaround shown. The copy says "may" when it is certain, and says nothing about products or enquiries.
**Suggested fix**: At minimum, skip the write (and the status change) when nothing differs from the stored row, and change the copy to say plainly that saving takes the business and all of its products off the site until an admin re approves it. If that is more disruption than the client wants, it is an `/architect` question (for example, keep the approved version live while a pending edit waits for review), and the amended AC-6 should then name the product and enquiry impact explicitly.
**Resolved**: a save with no changes (and no new logo) now skips the write, so the listing stays live. Proven live: an unchanged save kept it `approved`. The copy now says plainly that a real change hides the business and all its products, and blocks enquiries, until an admin re-approves it.

## Minor

### 🟡 Parallel uploads can still orphan images after a failure, `lib/actions/submit-product.ts:159`
**Problem**: `Promise.all` rejects on the first failed upload while the others are still in flight. `cleanupUploadedImages(uploadedKeys)` runs at that moment, so an upload that finishes after the rejection is pushed into `uploadedKeys` too late and is never deleted.
**Why it matters**: The comment promises that a failed upload "cleans up whatever already made it to R2". Under a transient R2 error this leaves the slow uploads behind. The unit test passes because the mocks settle in order.
**Suggested fix**: Use `Promise.allSettled`, then delete every fulfilled key if any upload was rejected.
**Resolved**: `Promise.allSettled`, so uploads that finish after a failure are cleaned up too. A test covers it.

### 🟡 The logo preview survives a failed submit while the file itself is cleared, `components/business-listing-form.tsx:97`
**Problem**: The form uses `<form action={handleSubmit}>`, which resets the uncontrolled file input on every submission (the comment says so). `logoPreview` is state and keeps showing the chosen image. In edit mode, after any field error the supplier sees their new logo, fixes the other field, saves, and the old logo is kept silently. In create mode the browser's `required` check then blocks the retry with a generic "select a file" prompt while a logo is visibly shown.
**Why it matters**: The screen shows a state the form will not submit, which is confusing and loses the logo change in edit mode.
**Suggested fix**: Switch to a plain `onSubmit` with `preventDefault` like `product-submission-form.tsx` does, so the file input keeps its value on error, or reset `logoPreview` to the stored logo whenever a submission fails.
**Resolved**: the form uses `onSubmit` now, so the chosen file is no longer cleared on a failed save.

### 🟡 Copy promises things that are not built, `components/business-listing-form.tsx:90`, `components/product-submission-form.tsx:66` and `components/site-header.tsx:315`
**Problem**: Both success screens say "We'll let you know once an admin has reviewed it" (or "approved it"). Nothing in this repo sends a notification, and no scope row covers one. The signed in mobile menu says "Manage products & leads", but there is no page listing a supplier's products or enquiries.
**Why it matters**: Suppliers will wait for a message that never comes, and look for a leads view that does not exist.
**Suggested fix**: Say "Check back on this page to see its status" (and link to `/list-business`) until notifications exist, and change the menu line to what exists today, for example "Add products and edit your business".
**Resolved**: "We'll let you know" is replaced with where to look (this page, or your company page), and the header says "Manage your business & products".

### 🟡 A categories failure leaves an empty, unusable product form, `app/products/new/page.tsx:60`
**Problem**: `getCategoriesWithProductCounts()` returns `null` on error, and the page passes `?? []`, so the category select has only its disabled placeholder. The supplier cannot submit and is not told why.
**Why it matters**: A transient database error looks like a broken form.
**Suggested fix**: When the result is `null`, render a short "Could not load categories, please refresh" message instead of the form.
**Resolved**: `/products/new` shows a clear "couldn't load the categories" message instead of an empty form.

### 🟡 Spec 0005 still describes the approved listing as read only in its contract, `docs/specs/0005-supplier-business-listing/index.md:62`
**Problem**: Today's AC-6 amendment updated the criterion, but the contract table still lists `not_editable` as an error of `updateBusinessListing`, the state table (line 78) and the test scenarios (lines 100 and 102) still expect an approved write to return `not_editable`, and the Follow up items on lines 139 and 141 (build product submission, decide whether an approved company is editable) are both done.
**Why it matters**: The next `/check verify` or `/test` pass that reads the contract will test for behavior that was deliberately removed.
**Suggested fix**: Amend those lines to match the shipped behavior, and tick or strike the two Follow up items with a pointer to scope feature 16 and `20260911050000`.
**Resolved**: AC-6 is amended, with a note at the top of the contract section pointing to it.

### 🟡 The edit action ignores a failed lookup and the cooldown is not serialized, `lib/actions/business-listing.ts:282`
**Problem**: The `existing` logo lookup discards its `error`, so on a failed read the old logo is never cleaned up after a replace. Separately, `update_business_listing` reads `updated_at` without a lock, so two concurrent saves can both pass the 10 second cooldown.
**Why it matters**: Small in practice (one orphan, one extra write), but the cooldown is described as a rate limit and a double submit defeats it.
**Suggested fix**: Treat a lookup error as "no previous logo known" explicitly and log it. In the function, `select ... for update` the company row before the cooldown check, the same serialization `create_product_submission` gets from its advisory lock.
**Partly resolved**: a failed lookup now returns a server error. The cooldown is still not serialized in SQL; two saves in the same instant could both pass, which only means two quick edits, not a security gap. Left as is.

## Nits

- ⚪ `lib/actions/business-listing.ts:25`, the 10 to 15 digit check counts the dial code, so `+91` plus an 8 digit local number passes. Worth checking the local part length when the dial code is `+91`.
- ⚪ `supabase/migrations/20260911070000_add_business_listing_address_and_postal_code.sql:615`, a rename keeps the old slug, so `/companies/<old-name>` stays the public URL. Fine if stable URLs are intended; worth one line in the spec saying so.
- ⚪ `supabase/migrations/20260911070000_add_business_listing_address_and_postal_code.sql:625`, an edit sets `pending` but leaves `verified = true`. Harmless because every read also checks `status`, but the admin queue will show a pending company that is already marked verified.
- ⚪ `lib/actions/submit-product.ts:146`, five sharp decodes run in parallel, each allowed up to 40 million pixels. A sequential loop keeps peak memory at one image.
- ⚪ `lib/actions/submit-product.ts:109`, repeats `collectFieldErrors` from `business-listing.ts`; a shared helper would keep the two in step.
- ⚪ `lib/actions/business-listing.ts:282`, the `existing` lookup runs even when no new logo was submitted; it can move inside `if (logo)`.

## Strengths

- Ownership cannot be spoofed: no action takes a company id from the client, every RPC resolves the company from the session's Clerk user id, and `20260925030000` removes EXECUTE from `anon` and `authenticated` so the RPCs cannot be called with the public key. One supplier cannot write to another's company by any path reviewed.
- PII stays private on public read paths: the anon column grant on `companies` excludes email, GST, address, postal code, rejection reason and `clerk_user_id`, `company_contacts` has no anon grant at all, and none of the public queries select those columns.
- `readVerifiedImage` is a good gate: magic bytes first, then a full sharp decode with a pixel cap, and the stored bytes are always the re encode, which strips EXIF (including phone GPS) and fixes rotation. Files are stored under the detected type, never the browser's claim.
- `submitProduct` is careful about ordering: company status and the hourly cap are checked before any upload, every file is verified before any is uploaded, and the database cap is authoritative under a per company advisory lock with a supporting index.
- Colors in every file in scope are theme tokens (`green`, `green-deep`, `green-wash`, `leaf`, `destructive`, `muted-foreground`); no raw palette classes.

## Test coverage

Both suites pass (43 tests, run during this review). `submit-product.test.ts` covers auth, every validation branch, the company status gate, the hourly preflight, a disguised non image, upload failure cleanup, RPC error mapping with cleanup, and the empty result case, using real sharp encoded images rather than mocked bytes. The extended `business-listing.test.ts` adds signed out refusal, every missing field, the WhatsApp digit check, the happy path RPC arguments including consent, the database check mappings and the edit error codes. Not covered: logo cleanup after a failed RPC (because it does not happen, see the major), a disguised logo on the edit path, the late settling upload in `submitProduct`, and anything about request size, which only a real browser submission of several full size images would show. Neither form component has a test, so the preview and thrown action behavior above are unguarded.

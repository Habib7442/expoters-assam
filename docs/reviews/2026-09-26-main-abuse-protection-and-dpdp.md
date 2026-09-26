# Review, main, 2026-09-26

**Reviewed by**: Claude Fable 5.1 (author on another model)
**Scope**: 18 files, feature review at HEAD of scope feature 17 (form abuse protection, spec 0006) and scope feature 18 (legal pages and DPDP compliance, no spec), plus the uncommitted paragraph in `app/privacy/page.tsx`
**Verdict**: Changes requested
**Follow up (2026-09-26)**: all three majors addressed (two fully, the sign up one needs a Clerk dashboard switch at go live) and 4 of the 7 minors fixed; the rest are marked Open with a reason.

## Summary

Feature 17 adds an invisible Cloudflare Turnstile check to Send Enquiry and Post Buy Requirement, verified server side before validation or any write, plus a per company hourly cap of 30 product submissions enforced under an advisory lock and pre checked before any R2 upload. Uploaded images are now identified by their bytes and re encoded by sharp. Feature 18 adds the Privacy Policy and Terms pages, a required consent checkbox whose version is stored on every enquiry, buy requirement and listing (with the database refusing a blank one), and a nightly pg_cron job that deletes enquiries and buy requirements after 12 months. The abuse protection code is solid: it fails open only where the spec says, never logs the secret, and handles the single use token correctly. The problems are on the legal side, where the Privacy Policy still promises things the code does not do: listings and account data are said to be deleted 30 days after an account is deleted, but nothing reacts to a deleted Clerk account, so the public listing and its WhatsApp number stay up forever. Account sign up collects personal data with no notice or consent at all. And today's new paragraph changed the policy materially without bumping the consent version or the "Last updated" date, so the consent records from now on point at the wrong text.

## Major

### 🟠 The policy promises deletion that nothing performs, `app/privacy/page.tsx:20`
**Problem**: The retention table says business listings and products are kept "until you delete your listing or account, then 30 days", and account information "until you delete your account, then 30 days". Section 2 (line 91) adds that "a withdrawn listing is taken off the directory". There is no self serve listing delete in this repo, and there is no Clerk `user.deleted` webhook (the purge migration's own comment at `20260925020000_add_personal_data_retention_job.sql:15` says so). Clerk's default `UserButton`, which the header renders, offers "Delete account" to every user.
**Why it matters**: A supplier who deletes their account in Clerk today keeps an approved, public company page with their name, location and WhatsApp number, and a private row with their email and GST number, indefinitely. That is the opposite of what the policy states, and under the DPDP Act the policy is the notice the consent was given against. It is also the easiest promise for a supplier to test and complain about.
**Suggested fix**: Pick one before go live. Either build the `user.deleted` sync (the `clerk-webhooks` skill covers it): unpublish the company immediately and hard delete the company, its products and its R2 images after 30 days; or change both retention rows to say deletion is done on request by email within a stated time, and turn off account self deletion in the Clerk dashboard so the two stay consistent. Either way, record the choice in the scope entry for feature 18.
**Resolved (engineer chose automatic deletion)**: a Clerk `user.deleted` webhook (`app/api/webhooks/clerk/route.ts`, signature checked with `verifyWebhook`) calls `deleteSupplierData`, which deletes the company (cascading to products, contact and memberships; enquiries keep their row with the link nulled) and then its R2 images. Proven live with a real test supplier: a forged event got 400 and deleted nothing; a signed event removed the company, product, contact and all 3 images; a repeat delivery returned 200. Needs the endpoint and `CLERK_WEBHOOK_SIGNING_SECRET` set up in Clerk and Vercel (go live, feature 19).

### 🟠 Clerk sign up collects personal data with no notice or consent, `app/sign-up/[[...sign-up]]/page.tsx:6`
**Problem**: The default `<SignUp />` collects name, email and possibly phone (the policy's own "Account information" item, line 49) with no link to the Privacy Policy or Terms and no consent step. Section 2 of the policy says consent is given "on the form where you enter it (sending an enquiry, posting a buy requirement, or listing a business)", which leaves account data with no consent basis stated at all. The Terms (line 21) say "by creating an account ... you agree to these terms", but the terms are never shown at sign up.
**Why it matters**: The scope's done criterion for feature 18 is "every form that collects personal data requires and stores consent", and sign up is the first form a supplier fills in. Account data reaches Clerk (in the US, per the policy) before any consent is recorded; the listing checkbox comes later and covers only the listing.
**Suggested fix**: Turn on Clerk's legal consent requirement (dashboard, "Legal" settings: require express consent, with the `/privacy` and `/terms` URLs), which adds a required checkbox to `<SignUp />` and stores the acceptance timestamp on the Clerk user. Then add account creation to the list in section 2 of the policy. This is a dashboard setting plus one sentence, so it also belongs on the go live list for the production Clerk instance.
**Partly resolved**: the policy now says what account data is for, what consent covers it, and that deleting the account deletes the listing. The sign up screen itself needs Clerk's legal consent setting switched on (dashboard, both instances); that is on the go live list (feature 19).

### 🟠 Material policy change without a version bump, `lib/consent.ts:7` and `app/privacy/page.tsx:31`
**Problem**: Today's paragraph (lines 118 to 124) discloses new facts: buy requirements are sent to the platform's own WhatsApp number, and "our team reads every requirement, public or private". The page still says "Last updated: September 25, 2026" and `CONSENT_NOTICE_VERSION` is still `"2026-09-25"`, although the comment on that constant says to bump it whenever the policy changes materially.
**Why it matters**: The whole point of storing `consent_notice_version` (DPDP s. 6(10)) is to prove which text a person agreed to. From today, rows stamped `2026-09-25` can mean either the old text or the new one, and there is no way to tell them apart. Rows written before today were consented against a notice that did not mention the team reading private requirements.
**Suggested fix**: Bump the constant and the "Last updated" date to `2026-09-26` in the same commit as the paragraph. Keep the old wording retrievable (git history is enough if the commit is tagged or noted), so an old version string can still be matched to its text.
**Resolved**: `CONSENT_NOTICE_VERSION` is now `2026-09-26`, and both the Privacy Policy and Terms say "Last updated: September 26, 2026".

## Minor

### 🟡 The new paragraph breaks the WhatsApp section's logic, `app/privacy/page.tsx:125`
**Problem**: The buy requirement paragraph was inserted between the enquiry paragraph and the one that begins "If you do, the supplier receives that message". "If you do" now reads as referring to the team link, and the following text talks about "the supplier" and says "we don't pass on the name, phone number, or email you typed", which for a buy requirement is not the point (the team sees them in the admin app).
**Why it matters**: This is the section that tells a buyer exactly what gets shared over WhatsApp, and a reader now gets a muddled answer. The Terms (section 4, line 64) still describe only the enquiry flow and do not mention the team number at all.
**Suggested fix**: Move the buy requirement paragraph after the "If you do" paragraph, and add one sentence to it saying the team sees the WhatsApp profile name and number the buyer sends from. Mirror the one line in Terms section 4.
**Resolved**: the buy requirement paragraph now comes after the enquiry explanation, and Terms section 4 mentions the team's WhatsApp link.

### 🟡 The purge can race a returning buyer and roll back the whole night's run, `supabase/migrations/20260925020000_add_personal_data_retention_job.sql:37`
**Problem**: The comment says the 1 day floor on `buyers.created_at` "keeps this from ever racing a buyer whose first row is still being written". That only covers new buyers. A returning buyer whose old rows were all purged has an old `created_at` and no rows, so they match the delete. If their new enquiry is in flight at 02:00 IST, two outcomes are possible. If `get_or_create_buyer`'s upsert locks the row first, the purge's DELETE waits, deletes anyway (its NOT EXISTS used the old snapshot), and the `ON DELETE RESTRICT` check then sees the newly committed enquiry and raises a foreign key error, which aborts the entire purge transaction, including every enquiry and buy requirement it deleted. If the purge wins, the upsert simply inserts a new buyer, which is fine. No data is lost either way, and the window is tiny.
**Why it matters**: A failed run is only visible in `cron.job_run_details`, which nobody watches, so a retention promise could quietly slip by a day (or more if it recurs). The misleading comment will also mislead the next person who touches this function.
**Suggested fix**: Take the same per buyer advisory lock the `create_*` functions take (`pg_advisory_xact_lock(hashtext(b.id::text))`, or a `FOR UPDATE SKIP LOCKED` pass that selects candidate buyers first), or at least delete buyers in a separate statement wrapped so its failure does not undo the row deletes. Correct the comment. Add a check of the last run's status to the go live list or an admin health view.
**Open**: left as is. The effect is one skipped night, which the next run fixes. Worth a SKIP LOCKED pass later.

### 🟡 Retention periods are unconfirmed and duplicated, `app/privacy/page.tsx:16` and `20260925020000_add_personal_data_retention_job.sql:26`
**Problem**: The `TODO(client)` says the periods are proposed defaults, but the page publishes them as fact and the 12 month period is hardcoded separately in SQL. Nothing ties the two together, and the TODO is not on the go live list (scope feature 19).
**Why it matters**: If the client picks a different period, the page and the job will disagree unless someone remembers both places and writes a new migration. Going live with unconfirmed legal commitments is a client sign off item, not an engineering one.
**Suggested fix**: Add "client confirms retention periods and the Grievance Officer" to feature 19. Put a comment next to `RETENTION` pointing at the migration (the migration already points back).
**Open, on the go live list**: the client has to confirm the periods (feature 19).

### 🟡 The enquiry consent names a purpose that does not happen, `components/send-enquiry-dialog.tsx:183`
**Problem**: The checkbox says the details are used to "record this enquiry and let the supplier contact me about it". The policy (lines 129 and 158 to 161) says the opposite: the typed name, phone and email are never shared with suppliers; the supplier can only reply if the buyer sends the WhatsApp message.
**Why it matters**: Consent under the DPDP Act has to name the actual purpose. The label overstates the sharing, which is the thing buyers are most likely to care about, and contradicts the policy it links to.
**Suggested fix**: Change the purpose to something like "record this enquiry so the platform team can follow it up", matching what the admin team actually does with it.
**Resolved**: the purpose now reads "record this enquiry and help me contact the supplier on WhatsApp".

### 🟡 Vercel is missing from the processors, `app/privacy/page.tsx:144`
**Problem**: The list names Clerk, Supabase, Cloudflare, Razorpay and PostHog, but not Vercel, which hosts the site and receives every form submission and every visitor's IP address in its request logs. The transfers sentence (line 152) mentions only Australia and the US auth provider, while Vercel and Cloudflare both process data globally.
**Why it matters**: The review brief asked whether all processors are named. Vercel is the one that sees everything and it is absent.
**Suggested fix**: Add "Vercel (website hosting)" to the list and widen the transfer sentence to "including Australia and the United States".
**Resolved**: Vercel is named as the host, the transfer sentence covers global serving, and Razorpay and PostHog are described as coming later rather than current.

### 🟡 Submitting before the invisible check finishes always fails the first time, `components/send-enquiry-dialog.tsx:193` and `components/buy-requirement-form.tsx:200`
**Problem**: The submit button is enabled while the Turnstile token is still `null`. A quick user (browser autofill, a short message) can submit before the invisible check returns, and `verifyTurnstile` treats the missing token as `failed` (`lib/security/turnstile.ts:35`), showing "We couldn't confirm you're not a bot". The same happens forever for a visitor whose extension or network blocks `challenges.cloudflare.com`, with nothing telling them why.
**Why it matters**: The retry works because the widget resets, so this is friction, not data loss. But the first attempt of a real buyer is exactly the lead the fail open design is meant to protect.
**Suggested fix**: When a site key is set, disable the submit button (or show "Checking your browser...") until a token arrives, and if the script fails to load, show a message that names the cause rather than the generic bot message.
**Resolved**: both forms keep submit disabled until the token arrives whenever a site key is configured (proven live: disabled on load, enabled once the token lands). Without keys, forms don't wait.

### 🟡 The widget's token handling is untested, `components/turnstile-widget.tsx:77`
**Problem**: The single use rules live in the widget: `reset()` clears the parent token, and the unmount cleanup nulls it so a reopened dialog cannot resend a used token. Neither behavior has a test; the action tests only mock `verifyTurnstile`, and `/check verify` proved the reset by hand once.
**Why it matters**: The test signal is configured, and this is branching logic that protects AC-2. A later refactor that drops the cleanup line would pass every test.
**Suggested fix**: A small component test with a fake `window.turnstile`: callback sets the token, `reset()` clears it and calls `turnstile.reset`, unmount calls `remove` and clears it.
**Open**: there is no component test setup; the reset behavior was proven live in `/check verify`.

## Nits

- ⚪ `lib/security/turnstile.ts:52`, Cloudflare can answer 200 with `success: false` and `error-codes: ["internal-error"]` when its own side fails; that is treated as `failed` (fail closed), unlike a 5xx. Treating `internal-error` as `unavailable` would match AC-3's intent.
- ⚪ `lib/security/turnstile.ts:41`, the `hostname` in the siteverify response is not checked. Harmless while the site key allows only the production domain; worth a check if a second domain is ever added to the key.
- ⚪ `supabase/migrations/20260925050000_add_product_submission_rate_limit.sql:48`, the cap counts every product of the company, including ones an admin added. An admin bulk loading 30 products for a supplier blocks that supplier for an hour. Adding `submitted_by = 'supplier'` to both counts (and to `submit-product.ts:135`) would fix it.
- ⚪ `app/privacy/page.tsx:227`, "email ... from the email or phone number you used with us": you cannot send an email from a phone number. Say "and tell us the email or phone number you used".
- ⚪ `app/privacy/page.tsx:170` and `app/terms/page.tsx:66`, both say a public buy requirement shows product, quantity and location; the new paragraph and the column grant also include the date. Make the three agree.
- ⚪ `app/privacy/page.tsx:147`, PostHog and Razorpay are listed as current processors and cookies, but neither is installed yet (Razorpay is deferred). The "If we use" wording covers PostHog in section 1 but not in the sharing list.
- ⚪ `components/turnstile-widget.tsx:88`, the widget loads and sends browser signals to Cloudflare as soon as the form mounts, before consent is ticked. Defensible as a security purpose, and the policy describes it, but worth a conscious note in the scope entry.

## Strengths

- `verifyTurnstile` is small and exact: four named outcomes, only `failed` blocks, both fail open paths log without ever printing the secret or the token, the token length is bounded before it leaves the server, and a set secret with no site key is treated as not configured instead of silently rejecting every submission. The tests pin each of these.
- The product cap is done properly: the company comes from the Clerk user inside the function, the count runs under a per company advisory lock (proven with a 3 way race), and the action's pre check avoids any R2 upload while the database stays authoritative.
- Consent is enforced in the database, not just the form: every `create_*` rejects a blank version with `P0009`, the consentless overloads were removed with a clean expand and contract, and old rows are left honestly null rather than backfilled.
- `readVerifiedImage` checks magic bytes, fully decodes with a pixel limit, and always stores sharp's re encode, which also strips EXIF GPS data from supplier photos. The test for EXIF removal is a real one.
- Turning `is_public` off by default in both the form and the table is exactly right for DPDP, and the public column grant keeps buyer contact details unreadable even through the REST API.

## Test coverage

`lib/security/turnstile.test.ts` covers every outcome, including missing site key, rejected fetch and a 503. `lib/image-signature.test.ts` covers each format, disguised and truncated files, EXIF stripping and the size cap. The action tests cover the bot check block, the fail open path, the consent requirement and the `P0010` mapping, and the cap pre check before any upload. Not covered: the Turnstile widget's reset and unmount behavior (see the minor above), the `internal-error` response, and the purge function, which was proven live but has no repeatable test for the returning buyer race. The SQL consent guard and cron schedule were proven live, which is reasonable for this project.

# Verify: product page & send enquiry · spec 0003 · updated 2026-09-25
_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Visit an approved product (the demo `/products/assam-agarwood-chips-grade-a` was removed; last run used `/products/ahi-resin-gold`) → see name, images, description, category badge, company card (name, logo/initial, location, Verified badge) → AC-1
- [x] Visit `/products/does-not-exist` → 404 page, not a blank page or a leaked error → AC-1
- [x] A product whose company is `pending` (not `approved`) → visiting its slug → 404, not a page with an empty company card → AC-1
- [x] Click "Send Enquiry" → dialog opens with name/phone required, email/message optional → AC-2
- [x] Submit with only name + phone filled → success panel shown, dialog does not navigate away → AC-2
- [x] Double-click submit → button disabled while pending, no duplicate row → AC-2, AC-5
- [x] On a product whose company has a `company_contacts` row → success panel shows "Continue on WhatsApp" → its link is `wa.me/<number>?text=...` with the correct number and a readable pre-filled message → AC-3
- [x] Click "Continue on WhatsApp" on a phone → WhatsApp opens a chat to the supplier with the message pre-filled → AC-3
- [x] On a product whose company has no `company_contacts` row → success panel shows a plain "we've received your enquiry" message, no WhatsApp button → AC-4
- [x] Submit the same phone + same product twice within 10 minutes → second submission returns success but no second row in `enquiries` → AC-5
- [x] Submit a 6th enquiry from the same phone within an hour → rejected with a clear rate limit message, no new row → AC-5

## Commands
- [x] `npm run build` → passes, `/products/[slug]` listed as a dynamic route → AC-1
- [x] `npm run lint` → clean
- [ ] `npm run seed:demo` → creates/reuses the demo category, company, `company_contacts` row, and product idempotently → AC-1, AC-7 (skipped: a development tool only, and running it would publish demo data in the live database)
- [x] Anon Supabase client: `select * from company_contacts` → permission denied (42501), not empty rows → AC-6
- [x] `supabaseAdmin.rpc('create_enquiry', { p_product_id: <a pending or nonexistent product id>, ... })` → a `product_not_found` error, no row written → AC-8
- [x] Two products created with the same name in the same window both get unique slugs, neither insert fails → AC-7

## Acceptance-criteria coverage
_Last run 2026-09-25 (second run, same day) by `/check verify`: `npm run lint`, `tsc --noEmit`, and `npm run build` all exit 0. UI steps driven in headless Chromium (Playwright) against a local production build on port 3001 using Cloudflare's Turnstile test keys (the real key rejects `localhost`); `.next` rebuilt with the real keys afterwards. Temporary fixture companies (one `pending`, one with no `company_contacts` row, four approved ones with fake Clerk ids for the slug race) created for the run and deleted after, along with every test buyer and enquiry._

- AC-1: verified live: `/products/ahi-resin-gold` 200 with name, image, description, category badge, company card with Verified badge (no tier badge, correct since the company is `basic`); `/products/does-not-exist` and a product under a `pending` company both 404; `/products/[slug]` listed as dynamic in `npm run build`
- AC-2: verified live in a real browser: dialog opens, name and phone required, email and message optional, success panel without navigation, submit disabled right after a double click
- AC-3: verified live in a real browser: link is `https://wa.me/919577772757?text=Hi%2C%20I'm%20interested%20in%20AHI%20Resin%20Gold%20on%20Exporters%20Assam.`, matching the stored number, `whatsapp_forwarded_at` set; the engineer opened the link by hand and WhatsApp showed "Avadi Herbs India Pvt Ltd" with "Hi, I'm interested in AHI Resin Gold on Exporters Assam." pre-filled (desktop browser handoff page, "Open app" / "Continue to WhatsApp Web")
- AC-4: verified live in a real browser against a fixture company with no contact: "The supplier will get in touch soon", no WhatsApp button, row saved with `whatsapp_forwarded_at` null
- AC-5: verified live: two submissions (each double clicked) of the same product wrote one row; the 6th enquiry in an hour showed "You've sent several enquiries recently…" and wrote nothing; 6 concurrent RPC calls from one fresh phone wrote exactly 5 rows (one `RATE_LIMITED`)
- AC-6: verified live: anon `select *` and an embedded join from `companies` both get 42501 permission denied; anon cannot execute `create_enquiry` (42501)
- AC-7: verified live: 4 companies each calling `create_product_submission` with the same name at the same instant, twice, gave 8 unique URL safe slugs (`zz-verify-same-name` through `-8`) and no failure; a rename left the slug unchanged; the database refused an empty slug and `Not URL Safe!` (23514) and a duplicate (23505). Seed script not rerun (it would publish an approved demo company and product in the live database)
- AC-8: verified live: a pending company's product and a nonexistent id both return P0002 `product_not_found`, zero rows on the pending company

Noticed, not in this spec: after a rate limit rejection the dialog clears the name, phone, and consent fields; every page prefetches `/about`, `/contact`, `/faq`, which 404 (footer links to pages that do not exist).

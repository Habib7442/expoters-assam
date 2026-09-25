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
- [ ] Click "Continue on WhatsApp" on a phone → WhatsApp opens a chat to the supplier with the message pre-filled → AC-3
- [x] On a product whose company has no `company_contacts` row → success panel shows a plain "we've received your enquiry" message, no WhatsApp button → AC-4
- [x] Submit the same phone + same product twice within 10 minutes → second submission returns success but no second row in `enquiries` → AC-5
- [x] Submit a 6th enquiry from the same phone within an hour → rejected with a clear rate limit message, no new row → AC-5

## Commands
- [x] `npm run build` → passes, `/products/[slug]` listed as a dynamic route → AC-1
- [x] `npm run lint` → clean
- [ ] `npm run seed:demo` → creates/reuses the demo category, company, `company_contacts` row, and product idempotently → AC-1, AC-7
- [x] Anon Supabase client: `select * from company_contacts` → permission denied (42501), not empty rows → AC-6
- [x] `supabaseAdmin.rpc('create_enquiry', { p_product_id: <a pending or nonexistent product id>, ... })` → a `product_not_found` error, no row written → AC-8
- [ ] Two products created with the same name in the same window both get unique slugs, neither insert fails → AC-7

## Acceptance-criteria coverage
_Last run 2026-09-25 by `/check verify`: UI steps driven in headless Chromium (Playwright) against a local production build using Cloudflare's Turnstile test keys (the real key in `.env.local` rejects `localhost`, error 110200); temporary fixture companies (one `pending`, one with no `company_contacts` row) created for the run and deleted after._

- AC-1: verified live, including the pending company case (fixture product returned 404) and `npm run build`
- AC-2: verified live in a real browser: dialog opens, name/phone required, success panel without navigation, submit disabled on double click
- AC-3: verified live in a real browser: link is `wa.me/919577772757?text=...` naming the product, `whatsapp_forwarded_at` set; not yet tapped through to the WhatsApp app on a phone
- AC-4: verified live in a real browser against a fixture company with no contact: plain success message, no WhatsApp button, `whatsapp_forwarded_at` null
- AC-5: verified live: duplicate within 10 minutes wrote no second row, the 6th enquiry showed the rate limit message, 6 concurrent requests wrote exactly 5 rows
- AC-6: verified live: anon `select *` and an embedded join both get permission denied (42501), anon cannot call `create_enquiry`
- AC-7: partly verified: live data shows collision suffixing (`anwma-a1000`, `anwma-a1000-2`) and the database now rejects empty or non URL safe slugs (migration `20260925070000`); two concurrent creations of the same name not yet exercised; seed script not rerun (it would put demo data back into the live database)
- AC-8: verified live: a pending company's product and a nonexistent id both return `product_not_found`, no row written

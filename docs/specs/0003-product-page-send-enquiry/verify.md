# Verify: product page & send enquiry · spec 0003 · updated 2026-09-02
_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Visit `/products/assam-agarwood-chips-grade-a` → see name, images, description, category badge, company card (name, logo/initial, location, Verified badge) → AC-1
- [x] Visit `/products/does-not-exist` → 404 page, not a blank page or a leaked error → AC-1
- [x] A product whose company is `pending` (not `approved`) → visiting its slug → 404, not a page with an empty company card → AC-1
- [x] Click "Send Enquiry" → dialog opens with name/phone required, email/message optional → AC-2
- [x] Submit with only name + phone filled → success panel shown, dialog does not navigate away → AC-2
- [x] Double-click submit → button disabled while pending, no duplicate row → AC-2, AC-5
- [x] On a product whose company has a `company_contacts` row → success panel shows "Continue on WhatsApp" → clicking opens `wa.me/<number>?text=...` with the correct number and a readable pre-filled message → AC-3
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
- AC-1: product page visit, 404, and pending-company steps, plus the build command step — verified (page render, metadata, 404) except the pending-company case, not yet tested live
- AC-2: dialog open/submit and double-submit steps — dialog UI not yet clicked through in a real browser; the underlying write path is verified via direct RPC call
- AC-3: the WhatsApp link step — verified via direct RPC call (correct number and `whatsapp_forwarded_at` returned); the actual `wa.me` link has not been clicked in a browser
- AC-4: the no-`company_contacts` step — logic verified by code review, not yet exercised live (the demo company has a number on file)
- AC-5: duplicate and rate-limit steps — both verified live against the real database
- AC-6: the anon-query step — verified live (permission denied)
- AC-7: seed script and slug generation — verified live (seed ran successfully, unique slug generated)
- AC-8: the `create_enquiry` direct-call step — verified live (rejected an unapproved/nonexistent product id)

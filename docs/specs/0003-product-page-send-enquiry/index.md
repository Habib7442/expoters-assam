# 0003. Product page and Send Enquiry (core loop)

**Date**: 2026-08-27
**Status**: Accepted

## Summary

This spec designs the walking skeleton of the whole product: a buyer opens one real product page and sends an enquiry that lands in Supabase, then continues the conversation on WhatsApp themselves. It builds on the schema spec 0001 already locked, adding a small contact table for a supplier's WhatsApp number and a clean URL slug for a product, both left open by that spec. There is no WhatsApp API, no third party provider, and no message sending credential anywhere in this design: after a valid enquiry saves, the buyer gets a `wa.me` link, pre-filled with a short message about the product, that opens their own WhatsApp app. They send it themselves, from their own number, at no cost to the project. An independent cross check of an earlier draft (built against a server-side WhatsApp API, since dropped) caught a real security hole and several race conditions; those fixes carry forward into this version.

## Requirements

**User stories**:
- As a buyer, I want to see a product's details and contact the supplier without creating an account, so reaching out is frictionless.
- As a buyer, I want to reach a supplier on WhatsApp in one tap, so I don't have to copy a phone number or type it in myself.
- As the business owner, I want every enquiry recorded even if the buyer never completes the WhatsApp step, so no lead is ever silently lost.
- As the business owner, I want the enquiry endpoint protected from spam and abuse, so the directory's lead quality stays trustworthy.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: A visitor can open `/products/[slug]` for any product with `status = 'approved'` whose company also has `status = 'approved'`, and see its name, cover and gallery images, description, category, and company card (name, logo, location, verified badge, membership tier badge shown only for `silver`/`gold`). A product that does not meet that (missing, `pending`, `rejected`, or an unapproved company) returns a 404, never a blank page or a leaked internal error.
- **AC-2**: Clicking "Send Enquiry" opens a modal dialog with a form (name and phone required, email and message optional); a valid submission shows a success state without navigating away, and a resubmission is disabled while the request is in flight.
- **AC-3**: After a successful enquiry write, if the product's company has a `company_contacts` row, the success state includes a working `wa.me` link, pre-filled with a short message naming the product, that opens the buyer's own WhatsApp with the supplier's number as the recipient; `whatsapp_forwarded_at` is set at that same moment (this records that the platform successfully handed the buyer a working link, not that the buyer completed sending it or that the supplier read it).
- **AC-4**: If the company has no `company_contacts` row, the enquiry still saves exactly as normal and the buyer still sees a success state, just without a WhatsApp continue option; `whatsapp_forwarded_at` stays null and no error is recorded (there is no send attempt to fail, the number is simply absent).
- **AC-5**: A buyer whose phone has already generated 5 enquiries within the last rolling hour is rejected with a clear rate limit message and no new row is written, even when two of their requests arrive at the same instant. A first time or under the limit phone succeeds normally. A duplicate submission (same buyer, same product, within 10 minutes) returns success without writing a second row.
- **AC-6**: `company_contacts.whatsapp_number` is never readable by a direct Supabase query from the `anon`/`authenticated` role, under any query shape, including a broad `select('*')` or an embedded join from a table that role can otherwise read. The only way it ever reaches a browser is inside the response of a `sendEnquiry` call that already passed validation and the rate limit for that specific company's product, and only that one company's number.
- **AC-7**: Every `products` row has a unique, URL safe, non empty `slug` generated from its name at creation time; a name collision, including two concurrent creations of the same name, always resolves to a unique slug, never a write failure. A slug never changes after creation.
- **AC-8**: An enquiry can only ever be created against a product whose own `status` is `approved` and whose company's `status` is `approved`, regardless of what a client submits; a request naming any other product is rejected as not found and creates no row.

## Decision

**Chosen option**: Option 1: Click-to-chat (`wa.me`), buyer initiated, no WhatsApp API.

After a successful enquiry write, the server returns a `wa.me` deep link built from the company's stored WhatsApp number and a short pre-filled message; the buyer's own device opens their own WhatsApp app and they send the message themselves. No WhatsApp Business API, no BSP, no message credential, no per-message cost, and nothing for a third party to approve before this can go live.

**Implementation skills**: `supabase` (`supabase/supabase`, `.claude/skills/supabase/`) · `supabase-postgres-best-practices` (`supabase/supabase`, `.claude/skills/supabase-postgres-best-practices/`)

## Rationale

Reasoning, the options weighed (including the server-side API this replaces), and the cross check that reshaped the earlier draft: see `rationale.md`.

## Feature design

**Data model sketch** (additions to spec 0001's locked schema only):

| Table | Column | Type | Nullable | Notes |
|---|---|---|---|---|
| **company_contacts** *(new table)* | `company_id` | uuid, pk, fk → companies.id | no | `ON DELETE CASCADE`. One row per company that has provided a WhatsApp number; absence of a row means "no number on file." |
| | `whatsapp_number` | text | no | Normalized to `+<digits>` by a `BEFORE INSERT OR UPDATE` trigger, the same rule as `buyers.phone` (`check (whatsapp_number ~ '^\+[1-9][0-9]{9,14}$')`). |
| | `created_at` / `updated_at` | timestamptz | no | Standard defaults, `updated_at` kept current by a trigger. |
| **products** | `slug` | text | no | Unique. Generated at creation from `name` (rule below); a `unique_violation` on insert triggers a retry with a new suffix, never surfaces as a write failure. Never regenerated after creation, even if the product is renamed. |

RLS on `company_contacts` is enabled with **no policy at all** (the same pattern spec 0001 uses for `enquiries`/`buyers`/`memberships`: structurally unreadable by `anon`/`authenticated`, not filtered by a policy that could be gotten wrong). Because a table's default privileges in this project still grant `anon`/`authenticated` a bare `SELECT` unless explicitly revoked (spec 0001's `20260827074706_fix_phone_normalization_and_default_privileges.sql` only revoked write privileges), this migration also runs `revoke select on public.company_contacts from anon, authenticated;` as a second, redundant layer. Only `supabaseAdmin` (service role) can read it directly. The number still reaches a buyer, deliberately, through the `sendEnquiry` action's own response, never through a Supabase query the browser could make itself (AC-6).

**One new SQL function** (called only via `supabaseAdmin.rpc`, never from the anon client):

```sql
-- Atomically resolves/creates the buyer, rate-limits, de-duplicates, inserts
-- the enquiry, and returns the company's WhatsApp number (if any) so the
-- caller can build the wa.me link in the same round trip. No two requests
-- can race each other (AC-5, AC-8).
create or replace function public.create_enquiry(
  p_phone text,
  p_name text,
  p_email text,
  p_product_id uuid,
  p_message text
) returns table (enquiry_id uuid, rate_limited boolean, whatsapp_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
  v_product record;
  v_recent_count int;
  v_existing_id uuid;
  v_new_id uuid;
  v_wa_number text;
begin
  -- AC-8: only an approved product whose company is also approved
  select p.id, p.name, p.company_id, c.name as company_name
    into v_product
  from products p
  join companies c on c.id = p.company_id
  where p.id = p_product_id and p.status = 'approved' and c.status = 'approved';

  if v_product.id is null then
    raise exception using errcode = 'P0002', message = 'product_not_found';
  end if;

  select id into v_buyer_id from public.get_or_create_buyer(p_phone, p_name, p_email);

  -- serialize concurrent requests from the same buyer before counting (AC-5)
  perform pg_advisory_xact_lock(hashtext(v_buyer_id::text));

  select cc.whatsapp_number into v_wa_number
  from company_contacts cc where cc.company_id = v_product.company_id;

  -- de-duplicate a double submit: same buyer, same product, last 10 minutes
  select id into v_existing_id from enquiries
  where buyer_id = v_buyer_id and product_id = v_product.id
    and created_at > now() - interval '10 minutes'
  limit 1;

  if v_existing_id is not null then
    return query select v_existing_id, false, v_wa_number;
    return;
  end if;

  select count(*) into v_recent_count from enquiries
  where buyer_id = v_buyer_id and created_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    return query select null::uuid, true, null::text;
    return;
  end if;

  insert into enquiries (
    buyer_id, product_id, company_id, product_name, company_name,
    contact_name, contact_email, message, whatsapp_forwarded_at
  )
  values (
    v_buyer_id, v_product.id, v_product.company_id, v_product.name, v_product.company_name,
    p_name, p_email, p_message, case when v_wa_number is not null then now() else null end
  )
  returning id into v_new_id;

  return query select v_new_id, false, v_wa_number;
end;
$$;
```

`create_enquiry` creates a `buyers` row even when the request is ultimately rate limited or deduplicated (the lookup has to happen before the limit can be checked) — this is the correct trade, it's how a human could later identify and unblock a legitimate buyer who got rate limited. There is no second function for a WhatsApp send outcome (no async call exists to have an outcome): `whatsapp_forwarded_at` is set inside the same insert, synchronously, the moment a `company_contacts` row is found.

**Slug generation rule** (`generateUniqueSlug(name)`, an app level helper, reused later by feature 10's supplier submission flow): NFKD-normalize the name, strip diacritics, lowercase, replace runs of non-alphanumeric characters with a single hyphen, trim leading/trailing hyphens, truncate to 80 characters; if the result is empty (e.g. a name in a script the naive rule strips entirely), fall back to `product-<8 char random id>`. Insert with that slug; on a `23505` unique violation against `products_slug_key`, retry up to 3 times appending `-2`, `-3`, then `-<6 char random suffix>` — never a random suffix on the first attempt, so ordinary names stay clean.

**API surface**:

| Surface | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/products/[slug]` | Page (RSC) | `slug` (route param) | product + category + company data (see Value sourcing) | public | `notFound()` on no matching row |
| `sendEnquiry` | Server Action | `productId: uuid`, `name: string`, `phone: string`, `email?: string`, `message?: string` | `SendEnquiryResult` (below) | public, no auth | see Value sourcing / result codes below |

```ts
type SendEnquiryResult =
  | { ok: true; whatsappUrl: string | null } // null when the company has no number on file
  | {
      ok: false;
      code: "invalid_input" | "rate_limited" | "not_found" | "server_error";
      message: string;
      fieldErrors?: Record<string, string>;
    };
```

This is a server action, not an HTTP route, so there is no status code to pick; the discriminated `code` is what the dialog UI branches on.

**Zod input schema**:
```ts
const enquirySchema = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{10,20}$/),
  email: z.string().trim().email().optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional(),
});
```
Real phone normalization stays exactly where spec 0001 put it (the `get_or_create_buyer` DB function): this regex only rejects obviously invalid input before it reaches the database, it does not normalize.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Render product page | name, description, `image_url`, `gallery_urls` | `products` row by `slug` (anon client) |
| Render product page | category name | `categories` row via `product.category_id` |
| Render product page | company name, logo, location, verified badge | `companies` row via `!inner` join on `product.company_id`; RLS filters this to `status = 'approved'` automatically, so a missing company row (unapproved) makes the whole query return nothing, resolved to `notFound()` (AC-1) |
| Render product page | membership tier badge | `company_tiers` view via the existing `getCurrentTier`; rendered only when the tier is `silver`/`gold`, nothing shown for `basic` |
| Render product page | image `alt` text | cover image: the product name; each gallery image: `"<product name> — image <n>"` |
| Render product page | page title / description (`generateMetadata`) | `` `${product.name} — ${company.name} \| ExportsAssam` ``; description = `product.description` truncated to 155 chars, or a generic fallback sentence when null |
| `sendEnquiry` | `enquiry_id` / `rate_limited` / `whatsapp_number` | `create_enquiry(...)` (above), called via `supabaseAdmin.rpc`, in one transaction |
| `sendEnquiry` | product/company approval check (AC-8) | Enforced inside `create_enquiry`'s own `WHERE` clause, not the application layer; `supabaseAdmin` bypasses RLS, so this check has to live in the function |
| `sendEnquiry` | `enquiries.message` | the submitted message, or `null` when blank |
| `sendEnquiry` | `enquiries.buy_requirement_id` | always `null` for this feature (only set by scope feature 8/9) |
| `sendEnquiry` | `whatsappUrl` (the `wa.me` link) | Built server side, only when `create_enquiry` returned a non-null `whatsapp_number`: `` `https://wa.me/${whatsapp_number.replace('+','')}?text=${encodeURIComponent(message)}` ``, where `message` is `` `Hi, I'm interested in ${product.name} on ExportsAssam.` `` plus the buyer's own message when they gave one, trimmed |
| Product creation (this feature's seed script now; feature 10's submission flow later) | `products.slug` | `generateUniqueSlug(name)` (rule above) |

**Key invariants**:
- `company_contacts.whatsapp_number` always matches the normalized phone format (`^\+[1-9][0-9]{9,14}$`), the same rule as `buyers.phone`.
- `products.slug` is always unique, non empty, URL safe, and never changes after creation.
- An `enquiries` write never fails or blocks on anything WhatsApp related (AC-4); the only WhatsApp related thing this feature ever writes is `whatsapp_forwarded_at`, set synchronously at insert time, never `whatsapp_attempts`/`whatsapp_last_error` (there is no send attempt to fail).
- An enquiry is only ever created against a product and company that are both `approved`, enforced inside `create_enquiry`, never trusted from the client (AC-8).
- A rate limit or duplicate check never rejects a phone's genuinely first, non duplicate enquiry.
- `company_contacts.whatsapp_number` reaches a browser only inside a `sendEnquiry` success response, never through a query the browser issues itself.

**Security model**:
- Product page reads: anon client, RLS gated to `status = 'approved'` on both `products` and (via the inner join) `companies`, per spec 0001 AC-2. No new public exposure; `companies` itself carries no sensitive column.
- `company_contacts`: RLS enabled, no policy, explicit `revoke select` from `anon`/`authenticated` — structurally unreadable by a direct query, view, or embed (the database level half of AC-6). The number is deliberately handed to a specific buyer's browser by `sendEnquiry`, but only after that buyer's submission already passed validation, the approval check, and the rate limit for that exact product; there is no way to fetch it by browsing.
- `sendEnquiry`: no Clerk auth required, the buyer flow is intentionally anonymous (spec 0001's user story). All input validated server side with zod first; the authoritative approval check and the rate limit both live inside `create_enquiry`, not the application layer, so they hold even if a future caller bypasses the server action (AC-5, AC-8).
- No credentials of any kind are needed for this feature; there is no WhatsApp API client, key, or webhook.
- **Accepted risk, not built in this pass**: rate limiting is keyed on phone number only; a script rotating fake numbers could still walk through many companies' WhatsApp numbers this way, one per accepted enquiry. Lower stakes than the API design (no per-message cost is incurred), but still worth a note: see Follow-up.

**Configuration required**: none. This feature introduces no new environment variables or third party credentials.
- `SEED_DEMO_WHATSAPP_NUMBER` (optional, local/dev only): a real number the engineer controls, used only by the demo seed script in Build plan step 4, so the click-to-chat link can be manually verified end to end; never commit a real value.

**Critical test scenarios**:
- Happy path: open an approved product's page by slug, submit a valid enquiry, confirm the `enquiries` row has a resolved `buyer_id`, correct denormalized snapshots, and `whatsapp_forwarded_at` set, verifies **AC-1**, **AC-2**, **AC-3**, **AC-7**
- Happy path: the returned `wa.me` URL opens WhatsApp with the correct number and a readable pre-filled message, verifies **AC-3**
- Failure case: a company with no `company_contacts` row still gets the enquiry recorded, the buyer still sees success, and `whatsappUrl` is `null` (no WhatsApp button shown), verifies **AC-4**
- Failure case: two concurrent submissions from the same phone that would each individually be the 5th and 6th enquiry in the hour; exactly one is accepted, verifies **AC-5**
- Failure case: the same buyer submits the same product twice within 10 minutes; the second call returns success but no second row is written, verifies **AC-5**
- Failure case: `sendEnquiry` is called with a `productId` for a `pending` product (bypassing the UI); it is rejected as not found and no row is written, verifies **AC-8**
- Auth/permission: an anon Supabase client selecting from `company_contacts`, or embedding it via a join from `companies`, gets a permission error or no data, verifies **AC-6**
- Edge case: two products created with the same name in the same window both get unique slugs, neither write fails, verifies **AC-7**
- Edge case: an approved product whose company is still `pending` returns 404, not a page with an empty company card, verifies **AC-1**

## Build plan

1. Migration: create `company_contacts` (RLS enabled, no policy, explicit `revoke select` from `anon`/`authenticated`, the normalization trigger and format check), add `products.slug` (unique, not null; safe to add directly since `products` currently has zero rows), the `create_enquiry` function, and `create index on enquiries (buyer_id, created_at desc);` for the rate limit/dedup queries, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**
2. Run `supabase db push`, then `supabase gen types typescript --linked > lib/supabase/database.types.ts` and copy the file to `expoters-assam-admin`, satisfies **AC-6**, **AC-7** (later steps need `slug` and `company_contacts` in the generated types to typecheck)
3. Add `generateUniqueSlug(name)` (rule above) and `getProductBySlug(slug)` (anon client, inner join to `companies`, relies on RLS to filter both product and company approval) to `lib/supabase/queries/products.ts`, satisfies **AC-1**, **AC-7**, **AC-8**
4. Add `tsx` as a dev dependency; write `scripts/seed-demo.ts` (reads `SEED_DEMO_WHATSAPP_NUMBER`, inserts one demo category, one demo company with a `company_contacts` row, and one `approved` product with a generated slug and a placeholder image uploaded to the existing `product-images` bucket) and a `"seed:demo"` npm script, satisfies **AC-1** (manual verification only, not a shipped feature)
5. Build `app/products/[slug]/page.tsx` (`notFound()` when the query returns nothing) and `app/products/[slug]/error.tsx`, `generateMetadata` per Value sourcing, dynamic rendering (no `generateStaticParams`/`revalidate` in this pass), image `alt` text per Value sourcing, and `next.config.ts`'s `images.remotePatterns` pinned to `wpoikxdhzpzubionhkcw.supabase.co`, satisfies **AC-1**
6. Add shadcn's `dialog` component; build the Send Enquiry dialog and form (name/phone required, email/message optional), a pending-disabled submit button, and a success panel that does not auto close and resets the form on reopen, satisfies **AC-2**
7. Add `zod`; write the `sendEnquiry` server action: validate input against the schema above, call `create_enquiry` via `supabaseAdmin.rpc`, map its result (a new id, a duplicate id, or `rate_limited`) plus the `product_not_found` exception into `SendEnquiryResult`, and when `whatsapp_number` came back non-null, build `whatsappUrl` per Value sourcing, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-8**
8. In the success panel, show a "Continue on WhatsApp" button (`target="_blank"`) when `whatsappUrl` is present, and a plain "We've received your enquiry" message when it is not, satisfies **AC-3**, **AC-4**
9. Manual verification against every Critical test scenario above, including a raw anon key query attempt against `company_contacts` (**AC-6**) and two genuinely concurrent submissions from the same phone (**AC-5**)

## Consequences

**Positive**:
- Zero cost, zero external approval process, zero credentials to manage; this half of the core loop can be live today, not gated behind a multi week business verification.
- Proves the buyer facing half of the core loop (page render, enquiry capture, a real path to WhatsApp) in one buildable, testable slice.
- `company_contacts` being structurally unreadable by a direct query (RLS, no policy, explicit revoke) rather than relying on per-query column discipline means a future `select('*')` on `companies`, a new public view, or a query written in the separate admin app can never accidentally leak a WhatsApp number in bulk.
- `create_enquiry` collapses the rate limit check, the duplicate check, the insert, and the WhatsApp number lookup into one transaction, so no concurrent request can slip past a check-then-act race.
- The buyer's own name and number are automatically visible to the supplier as the WhatsApp message's sender, with no separate field for either to enter or trust.

**Negative / tradeoffs**:
- No delivery or read confirmation: `whatsapp_forwarded_at` means "a working link was offered," not "the buyer sent it" or "the supplier saw it." A real drop-off between "enquiry saved" and "buyer actually taps send" is expected and currently invisible to the business.
- On a desktop browser, `wa.me` opens WhatsApp Web, which only works if the buyer's phone is already linked to it; on mobile it opens the WhatsApp app directly. This is standard `wa.me` behavior, not something this feature can improve on.
- Rate limiting is phone-only and, since there is no per-message cost this time, the only real cost of a script walking through many companies' numbers this way is directory abuse, not billing (accepted risk, see Security model and Follow-up).

**Neutral**:
- `enquiries.whatsapp_attempts` and `whatsapp_last_error` (from spec 0001) go unused by this feature; nothing in this design ever has a "failed attempt" to record, since building a URL from a stored string cannot fail. Kept in the schema for a possible future server-side send path.
- `products.slug` and its generation helper are built now for this feature's demo seed; the real product creation UI that will call it belongs to feature 10 (supplier self-service) and the separate admin app, which should reuse this helper, not reimplement it.
- No image/gallery upload UI is built here; the demo seed inserts a product row directly against spec 0001's existing `product-images` bucket.
- `/products/[slug]` renders dynamically with no static generation or ISR in this pass; feature 13 (SEO & GEO) is the natural place to revisit that once traffic patterns are known.

## Follow-up

- [ ] There is currently no way to know whether a buyer who got a `wa.me` link actually sent the message. A PostHog event (feature 14) on the "Continue on WhatsApp" button click, click-through rate against `whatsapp_forwarded_at`, is a cheap partial signal worth adding once PostHog is wired in; a true delivery/read confirmation would require a real WhatsApp API integration later, if the business ever decides it needs one.
- [ ] Consider a secondary, IP based rate limit and a honeypot field on the enquiry form if the phone-only limit proves insufficient against abuse in practice (accepted risk for this pass, see Security model).
- [ ] Full SEO treatment (JSON-LD structured data, OG images, sitemap entry, static generation/ISR) for the product page is scope feature 13; this spec only adds a basic `generateMetadata` title/description and dynamic rendering. The installed `seo-aeo-best-practices` skill is relevant there, not consulted in depth here.
- [ ] The rate limit (5 enquiries per phone per hour) has no admin visibility or override yet; a legitimate buyer who gets stuck currently has no way to be unblocked short of a direct database query.

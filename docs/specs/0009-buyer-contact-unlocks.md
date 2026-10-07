# 0009 · Buyer contact unlocks (IndiaMART style)

**Date**: 2026-10-07
**Status**: In Progress

## Summary

A supplier taps **Contact Buyer** on a public buy requirement and, after confirming, sees the buyer's name, phone, email, location and notes, with WhatsApp and Call buttons. Each unlock uses one buyer contact from the company's plan year: Basic 1, Silver 15, Gold unlimited. Opening the same buyer again is free. The site counts unlocks, not calls: a call happens off platform and can't be seen.

The client confirmed the limits on 2026-10-07 (Silver "15 buyers", Basic "can respond to 1", "do like IndiaMART"). The engineer chose: only requirements posted under the new privacy notice can be unlocked, and sharing is part of choosing to post publicly.

## Requirements

- **AC-1**: A public requirement posted with consent version `2026-10-07` or later shows **Contact Buyer**. Older public requirements keep **Respond** (the reply goes to the platform team, who introduce both sides).
- **AC-2**: Contact Buyer for a signed out visitor asks them to sign in; with no listing it links to `/list-business`; with an unapproved listing it says to wait for approval. None of these use a contact.
- **AC-3**: For an approved supplier, the dialog shows how many contacts are left and asks for confirmation. Confirming shows the buyer's details and uses one contact.
- **AC-4**: A repeat unlock of the same requirement by the same company never uses another contact.
- **AC-5**: With no contacts left, the dialog says so and links to `/membership`. Two unlocks at once can't both take the last contact (the company row is locked).
- **AC-6**: The plan year starts on the paid plan's `starts_at`; on Basic it is the last 12 months. An expired plan counts as Basic.
- **AC-7**: `/my-buyer-contacts` lists every buyer the company unlocked, newest first, with the allowance used, and is linked from the header for signed in users.
- **AC-8**: The admin Memberships page shows contacts used against the quota, for example `3 / 15`.
- **AC-9**: The post form, Privacy Policy, Terms and FAQ say that suppliers can unlock the contact details of a public requirement. `CONSENT_NOTICE_VERSION` is `2026-10-07`.
- **AC-10**: Hiding a requirement (`is_public = false`) makes it not unlockable. Contacts already unlocked stay on the supplier's list.

## Decision

- The limits live in one database function, `contact_allowances(company_ids[])`, shared by the unlock function, the storefront and the admin app.
- Unlocking runs in one database function, `unlock_buy_requirement(clerk_user_id, requirement_id)`, which locks the company row, so the limit holds under concurrency.
- Which requirements can be unlocked is a stored, generated column, `buy_requirements.contact_unlockable = is_public and consent_notice_version >= '2026-10-07'`. It is granted to the public roles (it isn't personal data), so the cached public pages can choose the button without a per user lookup. The dialog fetches the user's state when it opens.

**Implementation skills**: `supabase`, `supabase-postgres-best-practices`, `clerk-nextjs-patterns`.

## Data model

Migration `20261007010000_add_buyer_contact_unlocks.sql`:

| Object | Detail |
|---|---|
| `buy_requirements.contact_unlockable` | generated boolean, stored; `select` granted to anon and authenticated |
| `buy_requirement_unlocks` | `id`, `buy_requirement_id` (cascade), `company_id` (cascade), `created_at`; unique `(company_id, buy_requirement_id)`; RLS on, no policies |
| `contact_allowances(uuid[])` | returns tier, quota (null = unlimited), used and period start per company; `service_role` only |
| `unlock_buy_requirement(text, uuid)` | errors: `P0007` not approved, `P0004` not found or not public, `P0011` not unlockable, `P0012` quota used up; `service_role` only |

The 12 month retention job deletes old requirements, and their unlocks go with them (cascade).

## Value sourcing

| Value | Source |
|---|---|
| Company | `companies.clerk_user_id = auth().userId`, status `approved` |
| Tier and plan start | the active, unexpired `memberships` row, else Basic |
| Quota | `contact_allowances`: basic 1, silver 15, gold null |
| Buyer phone | `buyers.phone` (normalised `+<digits>`) |
| Name, email, notes | `buy_requirements.contact_name`, `contact_email`, `notes` |

## Build plan (done)

1. Migration (above), applied to Expoters Assam (`wpoikxdhzpzubionhkcw`), with types regenerated in both apps.
2. Wording: `lib/consent.ts`, `components/buy-requirement-form.tsx`, `app/privacy`, `app/terms`, `app/faq`, and the Buy Leads steps.
3. `lib/supabase/queries/buyer-contacts.ts`, `lib/actions/buyer-contact.ts` (`getBuyerContactStatus`, `unlockBuyerContact`).
4. `components/contact-buyer-dialog.tsx`, `components/buyer-contact-details.tsx`, the button choice in `components/buy-requirement-card.tsx`, `contactUnlockable` in `getLatestBuyRequirements`.
5. `app/my-buyer-contacts/page.tsx` and header links.
6. Admin: the "Buyer contacts used" column on Memberships.
7. Tests: `lib/actions/buyer-contact.test.ts` and the card test; `supabase/tests/buyer_contact_unlocks.sql`, a database scenario that rolls itself back.

## Consequences

- Buyers who post publicly will be called by suppliers directly. That's the IndiaMART model, and the form says so.
- Requirements posted before 2026-10-07 never become unlockable. They phase out under the 12 month retention.
- The buyer isn't notified when a supplier unlocks them (that would need an SMS or WhatsApp API).

## Follow-up

- Other plan perks are still not enforced: the product limit (5 / 25 / unlimited), the verified badge, ranking and home page featuring.
- Optionally ask suppliers later whether they connected with a buyer (the only way to learn whether deals close).
- `/sync`: AGENTS.md still names Razorpay.

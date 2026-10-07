# 0008 · Manual membership via WhatsApp

**Date**: 2026-10-06
**Status**: In Progress

## Summary

Membership is paid off the platform, not through Razorpay. On `/membership` the Silver and Gold buttons open WhatsApp to the platform number with the plan typed in. The supplier pays (the payment details are shared on WhatsApp) and sends the payment screenshot in that chat. The admin then sets the company's plan from the admin app's Memberships page, which lists every company, 20 at a time.

The client decided this on 2026-10-06. A first version saved a pending request on the website; the engineer replaced it the same day with this simpler flow (no request saved, the admin upgrades directly).

## Requirements

- **AC-1**: `/membership` shows Basic (Free, limited features), Silver (₹11,999 + GST per year, 15 buyer contacts per year) and Gold (₹23,999 + GST per year, unlimited buyer contacts). Prices were confirmed by the client on 2026-10-06.
- **AC-2**: The Silver and Gold buttons are `wa.me` links to `PLATFORM_WHATSAPP_NUMBER` with the plan and price typed in. If that setting is missing, they fall back to the contact email.
- **AC-3**: A "How to upgrade" box sets out the steps clearly: choose a plan on WhatsApp, pay using the details shared there, send the payment screenshot on WhatsApp, and wait for the admin to upgrade you. It also says payment is not taken on the website.
- **AC-4**: The admin Memberships page lists every company (any listing status), alphabetical, 20 per page, with Previous/Next links and a name search. Each row shows the email, WhatsApp number, listing status, current plan and plan end date.
- **AC-5**: The admin can set a company to Basic, Silver or Gold, after confirming. Silver and Gold start a one year plan from today. Basic ends the paid plan. The switch happens in one transaction (`set_company_plan`), so the public tier never shows two plans.
- **AC-6**: A plan past its `expires_at` counts as Basic on the public site (`company_tiers` view) and on the admin page, without anyone cancelling it.

## Decision

The plan is stored in the existing `memberships` table (`source = 'admin-manual'`), and the public tier still comes from the `company_tiers` view. No request row is saved on the website.

**Implementation skills**: `supabase`, `supabase-postgres-best-practices`.

## Data model

- `20261006010000_add_membership_requests.sql`: adds `pending` and `rejected` to the allowed statuses, adds `reviewed_at`, and a one pending row per company index. These are unused by this flow but harmless.
- `20261006020000_admin_set_company_plan.sql`: drops `approve_membership_request`. Adds `set_company_plan(company_id, tier)`, which locks the company and cancels its active and pending rows, then inserts an active one year row for Silver or Gold. Only `service_role` can run it. `company_tiers` now ignores expired plans.

## Build plan

1. Both migrations, applied to Expoters Assam (`wpoikxdhzpzubionhkcw`), with the types regenerated in both apps.
2. Storefront `app/membership/page.tsx`: prices, WhatsApp buttons, the steps box (AC-1 to AC-3).
3. Admin: `getCompanyPlans` (paged query), the `setCompanyPlan` action, the `CompanyPlanControl` component, and the Memberships page (AC-4 to AC-6).

## Consequences

- Perks are not enforced yet: product limits (5 / 25 / unlimited), buyer contacts (15 per year for Silver), the verified badge, ranking and home page featuring. The plan is recorded and readable through `company_tiers`; enforcing each perk is follow up work.
- Plans don't renew automatically. After a year, the admin sets the plan again once the supplier pays.

## Follow-up

- Enforce the plan perks (separate spec), starting with the product limit and the buyer contacts limit. "Buyer contacts" needs defining with the client: enquiries received, or buy requirements unlocked.
- `/sync`: AGENTS.md Sections 2, 4 and 6 still name Razorpay.

## Rationale

The client wants payment kept on WhatsApp, the same as every other deal on the platform. A direct WhatsApp link plus an admin picker is the smallest flow that does that.

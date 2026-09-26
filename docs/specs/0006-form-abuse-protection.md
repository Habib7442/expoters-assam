# 0006: Form abuse protection (bot check and per user limits)

**Status**: Accepted
**Date**: 2026-09-25
**Mode**: ENHANCEMENT

## Summary

The storefront's write forms were only rate limited by the phone number the visitor types in, which a bot can change on every request. This adds an invisible Cloudflare Turnstile bot check to the two anonymous forms (Send Enquiry, Post Buy Requirement), and a per company hourly cap on product submission. No IP address is stored anywhere. The existing per phone limits stay as a second layer.

## Context

Raised by a security review against the "Secure Vibe Coding" checklist (section 02, rate limiting). Today:

| Form | Who | Existing limit | Gap |
|---|---|---|---|
| Send Enquiry | anonymous | 5 per phone per hour, 10 min dedup (`create_enquiry`, `create_company_enquiry`) | phone is attacker chosen, so rotating numbers bypasses it |
| Post Buy Requirement | anonymous | 3 per phone per hour (`create_buy_requirement`) | same |
| Business listing (create) | signed in | one per Clerk user (`companies_clerk_user_id_key`) | none that matters |
| Business listing (update) | signed in | once per 10 seconds (`update_business_listing`) | none that matters |
| Submit Product | signed in, approved company | none | one account can submit without limit |

Clerk rate limits its own sign in and sign up (and has its own bot protection toggle), but never sees these server actions.

## Options considered

1. **IP counters in a Supabase table.** Slows spam, but an IP is personal data under the DPDP Act (needs keyed hashing and a retention job), many Indian mobile users share one IP through carrier NAT (false blocks), and bots can rotate IPs.
2. **Upstash Redis rate limiting by IP.** Same IP issues, plus a new vendor and secrets.
3. **Vercel Firewall rules.** No code, but coarse (server actions all post to page URLs), plan dependent, and no friendly message.
4. **Bot check on anonymous forms + per user limits on signed in forms (chosen).** Targets the actual threat (automated submissions) without storing personal data, and uses the Clerk identity we already have for signed in forms.

For the bot check: **Cloudflare Turnstile** (chosen: free with no usage cap, the project already uses Cloudflare for DNS and R2, portable if hosting changes) over **Vercel BotID** (runner up: tighter Vercel integration, but its stronger mode is a paid plan feature and it ties the check to Vercel hosting). Pricing and plan limits are as of the author's knowledge; verify current.

## Requirements

- **AC-1**: Send Enquiry and Post Buy Requirement render an invisible (managed) Turnstile widget, and the server action verifies its token with Cloudflare before validating input or writing anything. A missing or rejected token returns a friendly "please try again" error and writes nothing.
- **AC-2**: A Turnstile token is single use, so the widget resets after every failed submission, letting the user retry without reloading.
- **AC-3**: If Cloudflare's verify endpoint is unreachable or times out (5 seconds), the submission is allowed and the failure is logged (fail open: a lost buyer lead costs more than a few spam rows, and the per phone limits still apply).
- **AC-4**: If the Turnstile keys are not configured, the check is skipped and an error is logged on every request, so a missing production env var is visible in logs rather than silently breaking every form.
- **AC-5**: `create_product_submission` rejects a submission once the caller's company has submitted 30 products in the past hour (`P0010 rate_limited`), serialized per company with an advisory lock so concurrent requests can't both pass.
- **AC-6**: `submitProduct` checks the same cap before uploading any image, so a capped supplier never uploads to R2, and maps `P0010` to a `rate_limited` result with a friendly message.
- **AC-7**: No IP address or bot check data is stored in Supabase. The Privacy Policy names Cloudflare as the bot protection provider.

## Decision

Turnstile on the two anonymous forms, verified server side in the server action; a per company hourly cap in `create_product_submission`, pre checked in the action. Existing per phone limits unchanged.

**Implementation skills**: `supabase`, `supabase-postgres-best-practices` (the RPC change).

### Value sourcing

| Value | Source |
|---|---|
| Turnstile token | `cf-turnstile` widget callback, sent as `turnstileToken` in the action input |
| Site key | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public by design) |
| Secret key | `TURNSTILE_SECRET_KEY` (server only, never `NEXT_PUBLIC_`) |
| Company for the cap | `companies.id` resolved from the Clerk `userId` inside the RPC (never from the client) |
| Products in the past hour | `count(*)` of `products` where `company_id` matches and `created_at > now() - 1 hour` |

Local development uses Cloudflare's published test keys (always pass).

## Build plan

1. Server helper `lib/security/turnstile.ts` (`server-only`): `verifyTurnstile(token)` returns `passed` / `failed` / `unavailable` / `not_configured` (AC-1, AC-3, AC-4).
2. Client component `components/turnstile-widget.tsx`: loads the Cloudflare script once, renders explicitly, exposes `reset()` (AC-1, AC-2).
3. Wire into `sendEnquiry` + `SendEnquiryDialog` and `postBuyRequirement` + `BuyRequirementForm` (AC-1, AC-2, AC-3).
4. Migration: per company hourly cap in `create_product_submission` (AC-5); pre check and `P0010` mapping in `submitProduct` (AC-6).
5. Privacy Policy: Cloudflare named for bot protection (AC-7).
6. Tests for the helper's outcomes and the action mappings.

## Consequences

- A visitor with JavaScript disabled can't submit the anonymous forms (they already needed JavaScript).
- Two new env vars must be set in Vercel (production) before deploy, or the check is skipped (logged).
- A human pasting spam by hand still passes the bot check; the per phone limits remain the control for that.

## Follow-up

- Set real Turnstile keys in Vercel from the client's Cloudflare account (Turnstile, add site, managed mode, the production domain).
- Revisit IP based limits only if hand typed spam becomes a real problem.
- Content Security Policy rollout (see `next.config.ts`) must allow `challenges.cloudflare.com` for scripts and frames.

## Rationale

See *Options considered* above.

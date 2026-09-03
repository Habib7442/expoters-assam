# 0004. Cloudflare R2 for image storage

**Date**: 2026-09-02
**Status**: Proposed

## Summary

This spec moves where product and company images are stored, from Supabase Storage (decided in spec 0001) to Cloudflare R2 (an object storage service, like a bucket of files reachable by URL). Images stay served the same way to buyers, a plain public URL rendered by `next/image`; only where the file lives, and how the server uploads it, changes. The main reason is R2's zero cost for bandwidth out, which matters for a public directory expected to serve a lot of product photos over time. An independent cross check of the first draft found a real design flaw (two buckets can't share one public domain, the original design silently broke every company logo URL) and several other gaps; this version has all of them resolved. Nothing in the database schema changes.

## Context

This project's schema (spec 0001) already created two Supabase Storage buckets, `product-images` and `company-logos`, with public read access. Only one file lives in them so far, an image the demo seed script for scope feature 4 uploaded; nothing in production depends on Supabase Storage today.

The engineer wants to move to Cloudflare R2 instead, mainly for its bandwidth pricing: R2 charges nothing to serve files out (egress), where most object storage, Supabase Storage included, typically bills for it. For an image heavy public directory that expects real traffic over time, that is a real, ongoing cost difference, not a marginal one.

This is infrastructure, not user facing behavior: a buyer or supplier sees no difference, an image still renders at a URL. What changes is who owns the file (a separate Cloudflare account, not the existing Supabase project), how a server uploads it (a new S3 compatible client, not `supabaseAdmin.storage`), and what env vars/credentials a deploy needs.

A real constraint the first draft missed: an R2 custom domain (the mechanism that serves a bucket's contents publicly) requires the target domain's DNS to already be on Cloudflare. If `exportsassam.com` is not, connecting a custom domain is not a quick dashboard step, it is a full nameserver migration for the production domain. This spec's Build plan checks that precondition first, rather than assuming it.

Consequence of not deciding this now: scope feature 10 (supplier self-service product submission), the next feature that will build a real image upload flow, would build directly against Supabase Storage by default, and this move would then mean reworking that flow instead of building it once against the right target.

## Requirements

**User stories**:
- As the business owner, I want image hosting costs to stay flat as the directory grows (more products, more photos, more traffic), so a popular category doesn't turn into a bandwidth bill.
- As a developer on either app (this repo or the separate admin app), I want one small, server only helper to upload a file and get back its public URL, so I don't re-implement storage access per feature.

**Acceptance criteria**:
- **AC-1**: A file uploaded server side through the new helper is reachable at its public custom domain URL immediately after the upload call resolves, for both product images and company logos (one bucket, two key prefixes — see Feature design).
- **AC-2**: No module that reads an R2 credential from `process.env` is reachable from a client component's module graph. Verified two ways: (a) after a production build, no occurrence of the literal secret access key value anywhere under `.next/static/`; (b) a scratch `"use client"` file importing `lib/storage/r2.ts` fails the build with the exact `server-only` error, the same way importing `lib/supabase/admin.ts` from a client component does.
- **AC-3**: `next/image` renders an R2 hosted image (either prefix) without an "unconfigured host" error, in both local dev and a Vercel production build (the hostname is a literal in `next.config.ts`, not read from an env var at build time, so it can never be `undefined` in a build environment that only sets runtime vars).
- **AC-4**: The demo seed script (scope feature 4) uploads to R2 instead of Supabase Storage, and re-running it against an already-seeded database updates the existing product's `image_url`/`gallery_urls` to the new R2 URLs (not silently left pointing at Supabase Storage).
- **AC-5**: The R2 client is constructed with `requestChecksumCalculation: "WHEN_REQUIRED"` and `responseChecksumValidation: "WHEN_REQUIRED"`, avoiding the known R2/AWS SDK v3 checksum incompatibility on any installed SDK version (a config fix, not a version pin that ages).
- **AC-6**: The two Supabase Storage buckets from spec 0001 no longer accept public reads once this ships, so a call site mistakenly left pointing at them fails loudly instead of appearing to still work.

## Options considered

### Option 1: Cloudflare R2

Object storage with an S3 compatible API, connected to a custom domain for public reads.

**Pros**:
- Zero egress fees: no charge to serve files out, the main cost driver for an image heavy public site over time.
- S3 compatible API: no proprietary SDK to learn, `@aws-sdk/client-s3` (the industry standard client) works against it directly.
- A generous free tier (10 GB storage, 1 million write operations, 10 million read operations a month) covers this project's scale for a long while.

**Cons**:
- A second cloud account and its own credentials to manage, alongside Supabase and Clerk.
- Public access needs the target domain's DNS to be on Cloudflare, plus a one time custom domain setup; if the domain is not already on Cloudflare this is a real migration, not a quick step (see Context).
- No RLS equivalent: access control is "the credential can write, the custom domain serves reads to anyone," coarser than Postgres row level security, though images here are meant to be fully public anyway so this is not a real loss.

### Option 2: Stay on Supabase Storage (status quo)

Keep the buckets spec 0001 already created; build feature 10's upload flow against them as planned.

**Pros**:
- Already set up, already working (the demo seed's one uploaded file proves it); zero new accounts or credentials.
- One provider for the whole backend (database, auth adjacent data, and files), simplest mental model.

**Cons**:
- Typically bills for egress like most object storage, unlike R2; a real, compounding cost as the directory's image traffic grows, which is exactly the concern driving this decision.

### Option 3: Vercel Blob

Vercel's own object storage, tightly integrated with the hosting platform this project already deploys to.

**Pros**:
- Simplest possible integration for a Vercel hosted Next.js app: no S3 compatibility layer, a small native SDK.
- One less external account than R2 (billed through the existing Vercel account).

**Cons**:
- Bills for both storage and bandwidth; does not offer R2's zero egress model, so it does not address the actual driver of this decision.
- Ties image storage to the hosting choice; moving off Vercel later would mean moving storage too.

## Decision

**Chosen option**: Option 1: Cloudflare R2, **one bucket** (`exportsassam-images`) with two key prefixes (`products/`, `logos/`), one custom domain, uploaded to only from server side code.

A single bucket, not two, corrects the first draft's flaw (a custom domain attaches to exactly one bucket; two buckets would need two domains and a bucket-to-domain map for no real benefit). The prefix does the same logical separation spec 0001's two buckets did, with one domain, one credential scope, and one env var set to manage instead of two.

**Implementation skills**: none of this project's installed community skills cover Cloudflare R2 or the AWS SDK; none consulted.

## Rationale

The decision turns on the cost driver named in Context: egress. R2 is the only option of the three with zero egress cost (basis: Cloudflare's own pricing, verified below), which is exactly what a growing, image heavy public directory needs to not have hosting cost scale with traffic. Option 2 (stay put) does not address that at all, it was already the status quo the engineer is moving away from for this reason. Option 3 (Vercel Blob) is the easiest integration of the three but shares Supabase Storage's cost shape (bills bandwidth), so it does not solve the actual problem either, only trades one non zero egress bill for another.

R2's two real costs, a second account to manage and the DNS/domain precondition named in Context, are both one time. The egress saving compounds for as long as the directory serves images. The missing RLS equivalent is not a real loss here: every image this project stores (product photos, company logos) is meant to be publicly visible on a public directory, there is no private image to protect; the only credential to guard is the write path (Security model).

## Feature design

**Data model sketch**: none. `products.image_url`, `products.gallery_urls`, and `companies.logo_url` already store plain URL strings (spec 0001); they are provider agnostic and need no migration. Only what populates them changes.

**Module design**: split across two files so a plain Node script (the seed script; no Next.js bundler, no `react-server` condition) can use the R2 client without tripping the `server-only` guard, exactly the gotcha `scripts/seed-demo.ts` already documents for `lib/supabase/admin.ts` (that package throws unconditionally when imported outside Next's own module resolution, not only when actually bundled for a browser).

- `lib/storage/r2-client.ts` — **not** `server-only` guarded. Exports `createR2Client(credentials)` and `uploadToR2(client, config, category, key, file, contentType)`. Takes all credentials and config as explicit arguments; reads no env var itself, so it holds no ambient secret reference. Safe for the seed script (or any plain script) to import directly.
- `lib/storage/r2.ts` — `server-only` guarded, the app facing entry point. Reads the required env vars once at module load (failing fast, see Key invariants), constructs the client via `createR2Client`, and re-exports a zero-argument-config `uploadToR2(category, key, file, contentType)` that closes over it. Every app code call site (a future server action in feature 10, this repo's server code generally) imports this file, never `r2-client.ts` directly.
- `scripts/seed-demo.ts` imports `r2-client.ts` directly (it is a plain script, exactly like it already builds its own Supabase admin client instead of importing `lib/supabase/admin.ts`, for the same reason) and constructs its own client from the same env vars, read via `process.env` in the script itself.

**API surface** (an internal helper, not a user facing endpoint):

| Function | Inputs | Output | Auth | Key errors |
|---|---|---|---|---|
| `uploadToR2` (app facing, `lib/storage/r2.ts`) | `category: "products" \| "logos"`, `key: string`, `file: Buffer \| Uint8Array`, `contentType: string` | the public URL the file is now reachable at | server only (import guarded) | throws on an R2/network error, never swallows one |
| `uploadToR2` (core, `lib/storage/r2-client.ts`) | the above, plus an already constructed `S3Client` and `{ bucket, publicDomain }` | same | not guarded; caller supplies credentials | same |

**Value sourcing**:

| Action | Value produced | Source |
|---|---|---|
| `uploadToR2` | the returned public URL | `` `https://${publicDomain}/${category}/${encodeURIComponent(key)}` ``, each `/`-separated path segment individually `encodeURIComponent`'d (a supplier-uploaded filename, feature 10, may contain spaces or non-ASCII characters); built from the configured domain and the caller's category/key, not from R2's API response (R2's S3-compatible `PutObject` returns no public URL, only a write confirmation/ETag) |
| `uploadToR2` | the object's `Cache-Control` header | hardcoded `public, max-age=31536000, immutable` on every `PutObject`; keys are treated as immutable (Key invariants) so this is always safe |
| `lib/storage/r2.ts` module load | the R2 client's credentials/config | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_IMAGE_DOMAIN` from `process.env`; any missing var throws a named error at import time (Key invariants), not a downstream `undefined`-shaped failure |
| `next.config.ts`'s `images.remotePatterns` | the R2 hostname | a literal string in the file, the same value as `R2_PUBLIC_IMAGE_DOMAIN`, **not** read from `process.env` (Next evaluates `next.config.ts` at build time; a Vercel deploy that only sets this as a runtime var would otherwise silently produce `hostname: undefined` and break every image in production with no local reproduction) |
| Demo seed script | the object key for the demo product's image | a fixed, readable path (`agarwood-chips.webp`, under the `products/` category), same convention the current Supabase upload already uses |
| Demo seed script re-run | whether an existing demo product's `image_url` gets updated | `upsertProduct` no longer early-returns on a found row; it re-uploads and updates `image_url`/`gallery_urls` on the existing row (Build plan step 4b), so switching providers and re-seeding actually changes what the product page renders |
| Future real uploads (feature 10, not this spec) | the object key for a supplier's uploaded image | owed to feature 10's own spec: a collision-safe naming scheme (e.g. by product id) needs deciding there, not invented here |

**Key invariants**:
- `lib/storage/r2.ts` fails at import time, with a named error identifying the missing variable, if any of the five required env vars is unset — never a silent `undefined` passed into the S3 client.
- An object key is treated as immutable once uploaded: a changed image gets a new key, never an overwrite of an existing one. (S3-compatible `PutObject` overwrites unconditionally if a caller does reuse a key; there is no application level lock preventing it, this is a convention the seed script and future callers follow, not something the helper enforces.)
- The R2 client is always constructed with `requestChecksumCalculation: "WHEN_REQUIRED"` and `responseChecksumValidation: "WHEN_REQUIRED"` (AC-5).
- The bucket is never made public itself; only the custom domain serves reads. The R2 API token is scoped to this one bucket only, Object Read & Write, no forced expiry (rotate manually if ever compromised).
- One bucket, one credential set, shared between local development and production; the demo seed's objects live entirely under a fixed `products/` prefix so they are easy to identify and remove by hand. (No dev/prod bucket split in this pass — this project has no separate staging environment for Supabase either; revisit if that changes. Flagged in Follow-up.)

**Security model**:
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` live only in server env vars, never `NEXT_PUBLIC_*`. `lib/storage/r2.ts` is guarded with `server-only`, the same convention as `lib/supabase/admin.ts`; `lib/storage/r2-client.ts` is deliberately unguarded but holds no ambient credential (Module design), so the guard's protection is not weakened by the split.
- The bucket stays private; the custom domain is what grants public read access, so an object's key is readable if known but the bucket cannot be listed or written to without the credential. Key guessability is not treated as a real exposure: every image this project stores is meant to be public.
- The R2 API token is scoped to the single `exportsassam-images` bucket only (Key invariants), limiting the blast radius of a leaked credential to this one bucket, not the whole Cloudflare account.
- No new PII exposure: images are product photos and company logos, nothing personal, no change to the project's existing PII handling (buyer contact data, still entirely in Supabase per spec 0001).
- The two Supabase Storage buckets from spec 0001 have their public-read policy revoked as part of this spec's Build plan (AC-6), so a call site mistakenly left pointing at Supabase Storage fails loudly (a 403 on read) instead of appearing to still work.

**Configuration required**:
- `R2_ACCOUNT_ID`: the Cloudflare account id, used to build the S3 compatible endpoint URL
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`: an R2 API token scoped to the single bucket below, Object Read & Write
- `R2_BUCKET`: the one bucket name, `exportsassam-images`
- `R2_PUBLIC_IMAGE_DOMAIN`: the custom domain connected to the bucket for public reads (e.g. `images.exportsassam.com`); this exact value is also hardcoded as a literal in `next.config.ts` (Value sourcing) — keep the two in sync by hand if it ever changes
- No new Vercel-only configuration beyond adding the four secret vars to the project's env settings; the domain literal in `next.config.ts` needs no separate Vercel config since it ships in the built code

**Critical test scenarios**:
- Happy path: `uploadToR2("products", "test.webp", …)` writes a file, the returned URL loads the exact bytes uploaded, verifies **AC-1**
- Happy path: the same call with `"logos"` returns a URL under the `logos/` prefix that also loads correctly, verifies **AC-1** (the single-bucket, two-prefix design)
- Auth/permission: after `npm run build`, `.next/static/**` contains no occurrence of the real `R2_SECRET_ACCESS_KEY` value; a scratch client component importing `lib/storage/r2.ts` fails the build with the `server-only` error, verifies **AC-2**
- Failure case: an R2 write fails (bad credential, network error) → the helper throws, the caller does not silently continue with a broken URL, verifies **AC-1**
- Failure case: re-running the seed script after the demo product already exists updates its `image_url` to the new R2 URL rather than leaving the old Supabase Storage URL in place, verifies **AC-4**
- Failure case: after this ships, an anon (or any) request to the old Supabase Storage public URL for the demo image returns a permission error, not the file, verifies **AC-6**

## Build plan

0. **Precondition check**: confirm `exportsassam.com`'s DNS is already on Cloudflare. If not, that nameserver migration is a prerequisite to this entire spec and blocks every later step; do not proceed to custom domain setup until it is confirmed
1. Create the R2 bucket (`exportsassam-images`) and an API token scoped to it (Object Read & Write, no forced expiry); connect the custom domain (`R2_PUBLIC_IMAGE_DOMAIN`) to the bucket in the Cloudflare dashboard; add all five env vars to `.env.local` (and later to Vercel's project env vars, at both build and runtime scope)
2. Install `@aws-sdk/client-s3` at latest, no version pin (AC-5's config flags make the version irrelevant to the checksum issue)
3. Create `lib/storage/r2-client.ts` (the unguarded core: `createR2Client`, `uploadToR2` per Module design, with the checksum-disabling client config) and `lib/storage/r2.ts` (the `server-only` guarded, env-reading, fail-fast entry point), satisfies **AC-1**, **AC-2**, **AC-5**
4. Update `scripts/seed-demo.ts`:
   - a. Import `uploadToR2`/`createR2Client` from `lib/storage/r2-client.ts` directly (not `lib/storage/r2.ts`), constructing its own client from `process.env`, same pattern it already uses for its own Supabase admin client
   - b. Change `upsertProduct` to update `image_url`/`gallery_urls` on an already-existing row instead of early-returning, so a re-run actually switches the stored URL
   - satisfies **AC-4**
5. Update `next.config.ts`'s `images.remotePatterns`: add the R2 domain as a literal (`pathname: "/**"`), keep the existing Supabase Storage entry in the array until step 7 confirms nothing depends on it, satisfies **AC-3**
6. Migration: revoke the public-read storage policy on the `product-images` and `company-logos` Supabase buckets (leave the buckets themselves in place, per the engineer's choice not to delete them), satisfies **AC-6**
7. Re-run `npm run seed:demo`, confirm the product page (`/products/[slug]`) renders the image from the new R2 URL, then remove the now-unused Supabase Storage entry from `next.config.ts`'s `remotePatterns`, satisfies **AC-1**, **AC-4**
8. Edit spec 0001: mark its storage bucket section (the `product-images`/`company-logos` creation in its Build plan, and the related Configuration line) with an explicit note that it is superseded by spec 0004 for any new build; spec 0001's status line and everything else in it stays `Accepted` (its data model and RLS decisions are unaffected)

## Consequences

**Positive**:
- Image hosting cost no longer scales with traffic; the main, ongoing cost (egress) is zero regardless of how much a product photo gets viewed.
- The upload helper is a single, small, reusable piece (`lib/storage/r2.ts` / `r2-client.ts`) both this repo and the separate admin app can adopt, following the exact guard pattern already established for `supabaseAdmin`, correctly split so a plain script can use it too.
- No schema change, no data migration of anything real (the one demo file is dev only scaffolding, trivially re-seeded); revoking the old buckets' public-read policy means a stray old reference fails loudly instead of quietly working alongside the new one.

**Negative / tradeoffs**:
- A second cloud account and its own credential set to provision, rotate, and keep in sync across environments (local, and eventually Vercel's production env vars), on top of Supabase and Clerk.
- The custom domain step depends on the target domain's DNS already being on Cloudflare (Context); if it is not, this spec's Build plan is blocked on a real nameserver migration, not a quick step.
- Feature 10 (supplier self-service product submission) still owes its own decision: the object key naming scheme for a real supplier upload, and any file size/type validation. Not decided here, flagged in Follow-up.
- One shared bucket and credential set for both local development and production (Key invariants); a local `npm run seed:demo` run writes to the same bucket production serves. Acceptable at this project's current scale (no separate staging environment exists for Supabase either), but a real constraint if that changes.
- The separate admin app (its own repo, no access to this repo's `docs/specs/`) has no way to discover this decision on its own; it must be told by hand (Follow-up), or an engineer working there could reach for Supabase Storage by habit.

**Neutral**:
- The two existing Supabase Storage buckets (`product-images`, `company-logos`) stay in place but with public read revoked (Build plan step 6), per the engineer's choice not to delete them outright.
- `AGENTS.md` Section 4 currently describes Supabase as covering "database + storage"; that line becomes stale once this ships and should be corrected by `/sync`, not edited here.

## Follow-up

- [ ] Feature 10 (supplier self-service product submission) owes the object key naming scheme and any upload validation (file size, type, image dimensions) for a real supplier upload; this spec only covers the storage mechanism, not that flow's own design.
- [ ] No `deleteFromR2` helper exists yet. Once feature 10 lets a supplier replace or remove a product image, deleted/replaced objects will orphan in the bucket (a minor ongoing storage cost, not a security exposure since all images are meant to be public anyway). Add a delete path when feature 10 is designed, not before it's needed.
- [ ] `AGENTS.md` Section 4's "Supabase... database + storage" line is now stale; `/sync` should update it once this ships.
- [ ] Tell the separate admin app's `AGENTS.md` about this decision by hand (a manual, cross-repo step this spec cannot execute); it is the app where product/company images actually get added and edited by admin, per `AGENTS.md` Section 6.
- [ ] No dev/prod separation for the R2 bucket or credentials (Key invariants); revisit if this project ever adds a real staging environment.

## References

**Project sources** (verifiable, in this repo):
- Spec 0001 (`docs/specs/0001-database-schema-access-model/`), the Supabase Storage buckets and public read policies this decision moves away from
- `lib/supabase/admin.ts`, the `server-only` guard pattern `lib/storage/r2.ts` follows, and the exact reason it cannot be imported from a plain script (already documented in `scripts/seed-demo.ts`)
- `AGENTS.md` Section 9, the browser/server credential boundary this decision extends to R2; Section 3, the two-apps-no-shared-code convention this decision's admin-app Follow-up respects

**Practices & standards**:
- S3 compatible API as the standard way to integrate object storage that isn't natively supported by a project's existing SDKs
- Immutable object keys with a long `Cache-Control` max-age, the standard pattern for content served through a CDN/edge cache, so a changed file is a new URL rather than a stale cache risk

**Links** (web verified 2026-09-02):
- R2 setup and S3 compatible API: https://developers.cloudflare.com/r2/get-started/s3/
- R2 API token authentication: https://developers.cloudflare.com/r2/api/tokens/
- R2 with the AWS SDK for JavaScript v3: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
- R2 pricing (confirms zero egress, current storage/operation rates, free tier): https://developers.cloudflare.com/r2/pricing/
- R2 public buckets and custom domains: https://developers.cloudflare.com/r2/buckets/public-buckets/

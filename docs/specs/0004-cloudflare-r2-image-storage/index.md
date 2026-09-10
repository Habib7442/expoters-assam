# 0004 · Cloudflare R2 for image storage

**Date**: 2026-09-02
**Status**: In Progress

## Summary

This spec moves where product and company images are stored, from Supabase Storage (decided in spec 0001) to Cloudflare R2 (an object storage service, like a bucket of files reachable by URL). Images stay served the same way to buyers, a plain public URL rendered by `next/image`; only where the file lives, and how the server uploads it, changes. The main reason is R2's zero cost for bandwidth out, which matters for a public directory expected to serve a lot of product photos over time. An independent cross check of the first draft found a real design flaw (two buckets can't share one public domain, the original design silently broke every company logo URL) and several other gaps; this version has all of them resolved. Nothing in the database schema changes.

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

## Decision

**Chosen option**: Option 1: Cloudflare R2, **one bucket** (`exportsassam-images`) with two key prefixes (`products/`, `logos/`), one custom domain, uploaded to only from server side code.

A single bucket, not two, corrects the first draft's flaw (a custom domain attaches to exactly one bucket; two buckets would need two domains and a bucket-to-domain map for no real benefit). The prefix does the same logical separation spec 0001's two buckets did, with one domain, one credential scope, and one env var set to manage instead of two.

**Implementation skills**: none of this project's installed community skills cover Cloudflare R2 or the AWS SDK; none consulted.

## Rationale

Full reasoning and the two rejected alternatives: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: none. `products.image_url`, `products.gallery_urls`, and `companies.logo_url` already store plain URL strings (spec 0001); they are provider agnostic and need no migration. Only what populates them changes.

**Module design**: split across two files so a plain Node script (the seed script; no Next.js bundler, no `react-server` condition) can use the R2 client without tripping the `server-only` guard, exactly the gotcha `scripts/seed-demo.ts` already documents for `lib/supabase/admin.ts` (that package throws unconditionally when imported outside Next's own module resolution, not only when actually bundled for a browser).

- `lib/storage/r2-client.ts` — **not** `server-only` guarded. Exports `createR2Client(credentials)`, `uploadToR2(client, config, category, key, file, contentType)`, `deleteFromR2(client, config, category, key)`, and `parseR2Url(publicDomain, url)`. Takes all credentials and config as explicit arguments; reads no env var itself, so it holds no ambient secret reference. Safe for the seed script (or any plain script) to import directly.
- `lib/storage/r2.ts` — `server-only` guarded, the app facing entry point. Reads the required env vars once at module load (failing fast, see Key invariants), constructs the client via `createR2Client`, and re-exports zero-argument-config `uploadToR2`/`deleteFromR2`/`parseR2Url` that close over it. Every app code call site (`lib/actions/business-listing.ts`, and any future one) imports this file, never `r2-client.ts` directly.
- `scripts/seed-demo.ts` imports `r2-client.ts` directly (it is a plain script, exactly like it already builds its own Supabase admin client instead of importing `lib/supabase/admin.ts`, for the same reason) and constructs its own client from the same env vars, read via `process.env` in the script itself.

**API surface** (an internal helper, not a user facing endpoint):

| Function | Inputs | Output | Auth | Key errors |
|---|---|---|---|---|
| `uploadToR2` (app facing, `lib/storage/r2.ts`) | `category: "products" \| "logos"`, `key: string`, `file: Buffer \| Uint8Array`, `contentType: string` | the public URL the file is now reachable at | server only (import guarded) | throws on an R2/network error, never swallows one |
| `uploadToR2` (core, `lib/storage/r2-client.ts`) | the above, plus an already constructed `S3Client` and `{ bucket, publicDomain }` | same | not guarded; caller supplies credentials | same |
| `deleteFromR2` (app facing / core) | `category`, `key` (app facing); plus client/config (core) | none | same split as `uploadToR2` | throws on an R2/network error |
| `parseR2Url` (app facing / core) | a public URL this bucket served | `{ category, key }` or `null` if it doesn't match | pure function, no I/O | never throws, returns `null` on a non matching URL |

**Value sourcing**:

| Action | Value produced | Source |
|---|---|---|
| `uploadToR2` | the returned public URL | `` `https://${publicDomain}/${category}/${...key.split('/')}` ``, each `/`-separated segment (the category, and every segment of the key itself) individually `encodeURIComponent`'d — corrected from the first draft, which encoded the whole key as one blob and would have mismatched a multi-segment key like a logo's `clerkUserId/uuid.ext`; built from the configured domain and the caller's category/key, not from R2's API response (R2's S3-compatible `PutObject` returns no public URL, only a write confirmation/ETag) |
| `uploadToR2` | the object's `Cache-Control` header | hardcoded `public, max-age=31536000, immutable` on every `PutObject`; keys are treated as immutable (Key invariants) so this is always safe |
| `parseR2Url` | the category/key it returns | reverses `uploadToR2`'s URL construction exactly (strip the `publicDomain` prefix, first segment is category, the rest is the key, each `decodeURIComponent`'d); returns `null` if the category isn't `"products"`/`"logos"` or the URL doesn't match the configured domain |
| `lib/storage/r2.ts` module load | the R2 client's credentials/config | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_IMAGE_DOMAIN` from `process.env`; any missing var throws a named error at import time (Key invariants), not a downstream `undefined`-shaped failure |
| `next.config.ts`'s `images.remotePatterns` | the R2 hostname | a literal string in the file, the same value as `R2_PUBLIC_IMAGE_DOMAIN`, **not** read from `process.env` (Next evaluates `next.config.ts` at build time; a Vercel deploy that only sets this as a runtime var would otherwise silently produce `hostname: undefined` and break every image in production with no local reproduction) |
| Demo seed script | the object key for the demo product's image | a fixed, readable path (`agarwood-chips.webp`, under the `products/` category), same convention the current Supabase upload already uses |
| Demo seed script re-run | whether an existing demo product's `image_url` gets updated | `upsertProduct` no longer early-returns on a found row; it re-uploads and updates `image_url`/`gallery_urls` on the existing row (Build plan step 4b), so switching providers and re-seeding actually changes what the product page renders |
| Business listing logo upload (spec 0005, amended) | the object key for a supplier's logo | `{clerkUserId}/{uuid}.{ext}` under the `logos` category, decided in spec 0005, not here — this spec only supplies the mechanism |

**Key invariants**:
- `lib/storage/r2.ts` fails at import time, with a named error identifying the missing variable, if any of the five required env vars is unset — never a silent `undefined` passed into the S3 client.
- An object key is treated as immutable once uploaded: a changed image gets a new key, never an overwrite of an existing one. (S3-compatible `PutObject` overwrites unconditionally if a caller does reuse a key; there is no application level lock preventing it, this is a convention the seed script and future callers follow, not something the helper enforces.)
- A `deleteFromR2` call (added when spec 0005's logo replace flow moved to R2, not in this spec's original design) genuinely removes the object from the bucket, verified live via `HeadObject` returning `404` immediately after. Its public URL can still return a cached `200` for a while after that: every upload sets `Cache-Control: public, max-age=31536000, immutable`, and Cloudflare's edge honors that regardless of the origin object's state. This is accepted, not a bug: the immutable key convention above means nothing in the app references that URL once the database row moves to the new key, so a stale cached response at a now orphaned URL causes no real problem.
- The R2 client is always constructed with `requestChecksumCalculation: "WHEN_REQUIRED"` and `responseChecksumValidation: "WHEN_REQUIRED"` (AC-5).
- The bucket is never made public itself; only the custom domain serves reads. The R2 API token is scoped to this one bucket only, Object Read & Write, no forced expiry (rotate manually if ever compromised).
- One bucket, one credential set, shared between local development and production; the demo seed's objects live entirely under a fixed `products/` prefix so they are easy to identify and remove by hand. (No dev/prod bucket split in this pass — this project has no separate staging environment for Supabase either; revisit if that changes. Flagged in Follow-up.)

**Security model**:
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` live only in server env vars, never `NEXT_PUBLIC_*`. `lib/storage/r2.ts` is guarded with `server-only`, the same convention as `lib/supabase/admin.ts`; `lib/storage/r2-client.ts` is deliberately unguarded but holds no ambient credential (Module design), so the guard's protection is not weakened by the split.
- The bucket stays private; the custom domain is what grants public read access, so an object's key is readable if known but the bucket cannot be listed or written to without the credential. Key guessability is not treated as a real exposure: every image this project stores is meant to be public.
- The R2 API token is scoped to the single `exportsassam-images` bucket only (Key invariants), limiting the blast radius of a leaked credential to this one bucket, not the whole Cloudflare account.
- No new PII exposure: images are product photos and company logos, nothing personal, no change to the project's existing PII handling (buyer contact data, still entirely in Supabase per spec 0001).
- The two Supabase Storage buckets from spec 0001 no longer serve public reads (AC-6), so a call site mistakenly left pointing at Supabase Storage fails loudly instead of appearing to still work. **Verified live 2026-09-09, corrected from the original plan**: dropping the RLS `select` policy on `storage.objects` alone did not actually block reads (confirmed with a fresh, uncached request that still returned `200`) — Supabase Storage's `/storage/v1/object/public/...` URL path is gated by `storage.buckets.public`, a separate flag entirely from RLS, which only governs the authenticated/signed API paths. Setting `storage.buckets.public = false` for both buckets is what actually closes this; a stray reference now gets `400`, not `200`.

**Configuration required**:
- `R2_ACCOUNT_ID`: the Cloudflare account id, used to build the S3 compatible endpoint URL
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`: an R2 API token scoped to the single bucket below, Object Read & Write
- `R2_BUCKET`: the one bucket name, `exportsassam-images`
- `R2_PUBLIC_IMAGE_DOMAIN`: the custom domain connected to the bucket for public reads, `images.exportersasssm.com` (a dedicated domain registered for this purpose, not the main site's own domain — see rationale.md's Context); this exact value is also hardcoded as a literal in `next.config.ts` (Value sourcing) — keep the two in sync by hand if it ever changes
- No new Vercel-only configuration beyond adding the four secret vars to the project's env settings; the domain literal in `next.config.ts` needs no separate Vercel config since it ships in the built code

**Critical test scenarios**:
- Happy path: `uploadToR2("products", "test.webp", …)` writes a file, the returned URL loads the exact bytes uploaded, verifies **AC-1**
- Happy path: the same call with `"logos"` returns a URL under the `logos/` prefix that also loads correctly, verifies **AC-1** (the single-bucket, two-prefix design)
- Auth/permission: after `npm run build`, `.next/static/**` contains no occurrence of the real `R2_SECRET_ACCESS_KEY` value; a scratch client component importing `lib/storage/r2.ts` fails the build with the `server-only` error, verifies **AC-2**
- Failure case: an R2 write fails (bad credential, network error) → the helper throws, the caller does not silently continue with a broken URL, verifies **AC-1**
- Failure case: re-running the seed script after the demo product already exists updates its `image_url` to the new R2 URL rather than leaving the old Supabase Storage URL in place, verifies **AC-4**
- Failure case: after this ships, an anon (or any) request to the old Supabase Storage public URL for the demo image returns an error, not the file (`400`, once the bucket itself is set non public, not merely a `403` from an RLS policy, which alone doesn't block it), verifies **AC-6**
- Round trip: `parseR2Url` given a URL `uploadToR2` just returned recovers the exact same category and key, verifies the delete path's correctness (Key invariants)

## Build plan

0. [x] **Precondition check**: confirm the target domain's DNS is already on Cloudflare. **Done 2026-09-03**: `exportersasssm.com`, a domain registered specifically for this purpose, is connected to Cloudflare (full proxy, confirmed in the dashboard) — no production domain nameserver migration was needed
1. [x] Create the R2 bucket (`exportsassam-images`) and an API token scoped to it (Object Read & Write, single bucket, no forced expiry); connect the custom domain (`images.exportersasssm.com`, `R2_PUBLIC_IMAGE_DOMAIN`) to the bucket in the Cloudflare dashboard; add all five env vars to `.env.local`
2. [x] Install `@aws-sdk/client-s3` at latest, no version pin (AC-5's config flags make the version irrelevant to the checksum issue)
3. [x] Create `lib/storage/r2-client.ts` (the unguarded core: `createR2Client`, `uploadToR2` per Module design, with the checksum-disabling client config) and `lib/storage/r2.ts` (the `server-only` guarded, env-reading, fail-fast entry point), satisfies **AC-1**, **AC-2**, **AC-5**
4. [x] Update `scripts/seed-demo.ts`:
   - a. Import `uploadToR2`/`createR2Client` from `lib/storage/r2-client.ts` directly (not `lib/storage/r2.ts`), constructing its own client from `process.env`, same pattern it already uses for its own Supabase admin client
   - b. Change `upsertProduct` to update `image_url`/`gallery_urls` on an already-existing row instead of early-returning, so a re-run actually switches the stored URL
   - satisfies **AC-4**
5. [x] Update `next.config.ts`'s `images.remotePatterns`: add the R2 domain as a literal (`pathname: "/**"`), keep the existing Supabase Storage entry in the array until step 7 confirms nothing depends on it, satisfies **AC-3**
6. [x] Migration: revoke the public-read storage policy on the `product-images` and `company-logos` Supabase buckets (leave the buckets themselves in place, per the engineer's choice not to delete them). **This alone did not work, verified live**: `storage.buckets.public` is a separate flag from RLS that independently gates the `/storage/v1/object/public/...` URL path; a follow up migration also sets `public = false` on both buckets, which is what actually closes the read, satisfies **AC-6**
7. [x] Re-ran `npm run seed:demo`, confirmed the product page (`/products/[slug]`) renders the image from the new R2 URL (verified live via `next/image`'s optimizer, byte-identical content), then removed the now-unused Supabase Storage entry from `next.config.ts`'s `remotePatterns`, satisfies **AC-1**, **AC-4**
8. [x] Spec 0001's storage bucket section already carried an explicit "superseded by spec 0004" note from when this spec was originally written; confirmed still accurate, no further edit needed
9. [x] **Amendment (2026-09-09, decided inline with the engineer)**: migrated the supplier business listing feature's (spec 0005) logo upload from the `company-logos` Supabase bucket to R2, since step 6 would otherwise have broken it (spec 0005 predates this migration). Added `deleteFromR2`/`parseR2Url` to the module design (not originally planned) to preserve spec 0005's existing best-effort delete-on-replace behavior. Verified live: upload, byte-correct fetch, a full delete cycle confirmed via `HeadObject` returning `404`, and a `parseR2Url` round trip against `uploadToR2`'s own URL shape

## Consequences

**Positive**:
- Image hosting cost no longer scales with traffic; the main, ongoing cost (egress) is zero regardless of how much a product photo gets viewed.
- The upload helper is a single, small, reusable piece (`lib/storage/r2.ts` / `r2-client.ts`) both this repo and the separate admin app can adopt, following the exact guard pattern already established for `supabaseAdmin`, correctly split so a plain script can use it too.
- No schema change, no data migration of anything real (the one demo file is dev only scaffolding, trivially re-seeded); revoking the old buckets' public read means a stray old reference fails loudly instead of quietly working alongside the new one.

**Negative / tradeoffs**:
- A second cloud account and its own credential set to provision, rotate, and keep in sync across environments (local, and eventually Vercel's production env vars), on top of Supabase and Clerk.
- The custom domain step depends on the target domain's DNS already being on Cloudflare; resolved here by registering a dedicated domain rather than migrating the production domain (rationale.md's Context).
- One shared bucket and credential set for both local development and production (Key invariants); a local `npm run seed:demo` run writes to the same bucket production serves. Acceptable at this project's current scale (no separate staging environment exists for Supabase either), but a real constraint if that changes.
- The separate admin app (its own repo, no access to this repo's `docs/specs/`) has no way to discover this decision on its own; it must be told by hand (Follow-up), or an engineer working there could reach for Supabase Storage by habit.

**Neutral**:
- The two existing Supabase Storage buckets (`product-images`, `company-logos`) stay in place but with public read revoked (Build plan step 6), per the engineer's choice not to delete them outright.
- `AGENTS.md` Section 4 currently describes Supabase as covering "database + storage"; that line becomes stale once this ships and should be corrected by `/sync`, not edited here.

## Follow-up

- [x] Feature 10/16 (supplier product submission, not yet built) still owes its own object key naming scheme and upload validation for a real *product* upload; spec 0005 already decided this for the *logo* path (`{clerkUserId}/{uuid}.{ext}`, 2 MB, jpg/png/webp), which this spec's Build plan applied when migrating that call site to R2.
- [x] `deleteFromR2` and `parseR2Url` now exist in `lib/storage/r2-client.ts`/`r2.ts`, added when spec 0005's logo replace flow moved to R2 (sooner than this spec originally expected to need one).
- [ ] `AGENTS.md` Section 4's "Supabase... database + storage" line is now stale; `/sync` should update it once this ships.
- [ ] Tell the separate admin app's `AGENTS.md` about this decision by hand (a manual, cross-repo step this spec cannot execute); it is the app where product/company images actually get added and edited by admin, per `AGENTS.md` Section 6.
- [ ] No dev/prod separation for the R2 bucket or credentials (Key invariants); revisit if this project ever adds a real staging environment.

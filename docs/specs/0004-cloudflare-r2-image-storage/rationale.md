# 0004 · Cloudflare R2 for image storage — rationale

## Context

This project's schema (spec 0001) already created two Supabase Storage buckets, `product-images` and `company-logos`, with public read access. Only one file lives in them so far, an image the demo seed script for scope feature 4 uploaded; nothing in production depends on Supabase Storage today.

The engineer wants to move to Cloudflare R2 instead, mainly for its bandwidth pricing: R2 charges nothing to serve files out (egress), where most object storage, Supabase Storage included, typically bills for it. For an image heavy public directory that expects real traffic over time, that is a real, ongoing cost difference, not a marginal one.

This is infrastructure, not user facing behavior: a buyer or supplier sees no difference, an image still renders at a URL. What changes is who owns the file (a separate Cloudflare account, not the existing Supabase project), how a server uploads it (a new S3 compatible client, not `supabaseAdmin.storage`), and what env vars/credentials a deploy needs.

A real constraint the first draft missed: an R2 custom domain (the mechanism that serves a bucket's contents publicly) requires the target domain's DNS to already be on Cloudflare. This spec's Build plan checks that precondition first, rather than assuming it. **Resolved 2026-09-03**: rather than migrating the production domain's own nameservers, the engineer registered a dedicated domain for this purpose, `exportersasssm.com`, and has connected it to Cloudflare (full proxy, confirmed in the Cloudflare dashboard). Every domain literal in this spec uses this domain, via the subdomain `images.exportersasssm.com`, not the main site's own domain.

Consequence of not deciding this now: scope feature 10 (supplier self-service product submission), the next feature that will build a real image upload flow, would build directly against Supabase Storage by default, and this move would then mean reworking that flow instead of building it once against the right target.

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

## Rationale

The decision turns on the cost driver named in Context: egress. R2 is the only option of the three with zero egress cost (basis: Cloudflare's own pricing, verified below), which is exactly what a growing, image heavy public directory needs to not have hosting cost scale with traffic. Option 2 (stay put) does not address that at all, it was already the status quo the engineer is moving away from for this reason. Option 3 (Vercel Blob) is the easiest integration of the three but shares Supabase Storage's cost shape (bills bandwidth), so it does not solve the actual problem either, only trades one non zero egress bill for another.

R2's two real costs, a second account to manage and the DNS/domain precondition named in Context, are both one time. The egress saving compounds for as long as the directory serves images. The missing RLS equivalent is not a real loss here: every image this project stores (product photos, company logos) is meant to be publicly visible on a public directory, there is no private image to protect; the only credential to guard is the write path (index.md's Security model).

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

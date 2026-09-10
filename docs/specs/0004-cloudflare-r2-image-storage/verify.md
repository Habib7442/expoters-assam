# Verify: cloudflare r2 image storage · spec 0004 · updated 2026-09-09

_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Every step below except AC-5 was exercised live during the build (against the real linked Supabase project and the real Cloudflare R2 bucket/domain), not just typechecked; two real bugs were caught and fixed this way (see index.md's Build plan steps 6 and index.md's Value sourcing note on `uploadToR2`'s URL construction). AC-5 is a static config check (the checksum flags are set exactly as specced) with no distinct runtime symptom of its own to observe beyond the uploads/downloads above already working — see its own line under Acceptance-criteria coverage.

## UI / manual

- [x] Visit `/products/assam-agarwood-chips-grade-a` after re-seeding → the product image renders via `next/image`'s optimizer with no "unconfigured host" error → AC-3
- [x] Fetch the rendered image's underlying URL directly (`images.exportersasssm.com/products/demo/agarwood-chips.webp`) → `200`, `Content-Length` byte-identical to the original file, `Cache-Control: public, max-age=31536000, immutable` → AC-1
- [x] Fetch the old Supabase Storage URL for the same demo image after the migration → `400`, not the file → AC-6
- [x] Upload a test object under the `logos` category with a multi-segment key (`clerkUserId/uuid.ext`) → the returned URL resolves and serves the exact bytes uploaded → AC-1, and the URL-construction bug fix (per-segment encoding)
- [x] `parseR2Url` given that same URL recovers the exact category and key that produced it (round trip) → supports the delete path's correctness
- [x] Delete that same object via `deleteFromR2`, then `HeadObject` it directly against the bucket → `404`, confirming a real delete (independent of the object's public URL, which can still show a cached `200` for a while — expected, see index.md's Key invariants)

## Commands

- [x] `npx tsc --noEmit` → no errors
- [x] `npm run lint` → no errors
- [x] `npm run build` → succeeds; route table unchanged, no image-config errors
- [x] After `npm run build`, `grep` for the literal `R2_SECRET_ACCESS_KEY` value under `.next/static/` → no match → AC-2
- [x] A scratch `"use client"` page importing `lib/storage/r2.ts` → build fails with the exact `server-only` error (same shape as `lib/supabase/admin.ts`'s), scratch file removed after → AC-2
- [x] `npm run seed:demo` re-run against an already-seeded database → updates the existing product's `image_url`/`gallery_urls` to the new R2 URL, confirmed via a direct query → AC-4
- [x] Direct DB query: `select public from storage.buckets` for both old buckets → `false` on both, the actual fix (dropping the RLS policy alone left this `true`) → AC-6

## Acceptance-criteria coverage

- AC-1 … met (live): upload, byte-correct fetch, for both `products` and `logos` categories
- AC-2 … met (live): no secret in the client bundle, `server-only` guard confirmed by a real failing build
- AC-3 … met (live): `next/image` renders the R2 hosted image with no unconfigured-host error
- AC-4 … met (live): re-seeding updates the existing row's `image_url`, not left stale
- AC-5 … met by code (the checksum config flags are set exactly as specced); no separate runtime symptom to observe beyond uploads/downloads working, which they do
- AC-6 … met (live), on the second attempt: the RLS policy drop alone did not work (verified with a fresh, uncached request still returning `200`); setting `storage.buckets.public = false` is what actually closed it

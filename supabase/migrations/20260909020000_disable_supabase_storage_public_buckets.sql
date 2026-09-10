-- Follow up to 20260903140000: dropping the SELECT policy on
-- storage.objects alone did not actually block public reads. Verified
-- live: after that migration, the demo image still served 200 (CF-Cache-
-- Status: MISS, so not a stale cache) because Supabase Storage's
-- `/storage/v1/object/public/...` URL path is gated by
-- `storage.buckets.public`, a separate flag from RLS entirely; RLS only
-- governs the authenticated/signed API paths. Setting it false is what
-- actually achieves spec 0004's AC-6.

update storage.buckets set public = false where id in ('product-images', 'company-logos');

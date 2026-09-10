-- Cloudflare R2 (spec 0004) is now the storage backend for both product
-- images and company logos; the Supabase Storage buckets from spec 0001
-- stay in place (not deleted, per the engineer's choice) but no longer
-- serve public reads, so a call site mistakenly left pointing at them
-- fails loudly (a 403) instead of appearing to still work.

drop policy if exists product_images_public_read on storage.objects;
drop policy if exists company_logos_public_read on storage.objects;

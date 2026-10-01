# 0007 · Product and company management

**Status**: Assumed
**Date**: 2026-10-01
**Authorized by**: Habib Tanwir, during /develop ("do the best way")

## Owed decision
What a supplier can do to their own products after submitting them (edit, delete), and how an admin takes a product or a whole company down, temporarily or permanently. Before this, nothing could change once approved: suppliers could only add products, and the admin app could only approve or reject *pending* items.

## Assumption built on
1. **A new `hidden` status** on `products` and `companies` (check constraints widened). Hidden means "taken down by an admin, reversible": every public read path (RLS, list and detail queries, search functions, enquiry RPCs, sitemap, category counts) already requires `status = 'approved'`, so a hidden row disappears everywhere with no extra filtering. Distinct from `rejected`, which tells the supplier to fix and resubmit. A hidden row carries no `rejection_reason`.
2. **Supplier edits a product** (name, description, category, images: keep, remove or add, 1 to 5 total) from a new **My products** page. Saving sends it back to `pending` with the rejection reason cleared, so approved content can never be swapped without review. The slug stays the same, so links keep working. Allowed for `pending`, `approved` and `rejected` products of the supplier's own **approved** company; a `hidden` product is locked for the supplier. Written through a new `update_product_submission` RPC (ownership and state checked in the database, a 10 second edit rate limit like `update_business_listing`). Images the edit removed are deleted from R2 after the database write succeeds (best effort).
3. **Supplier deletes a product**, in any status including hidden: images are deleted from R2 first (abort on failure, same rule as `lib/supplier-deletion.ts`), then the row, scoped to the supplier's own company. Enquiries keep their row (`product_id` is `on delete set null`, `product_name` is a snapshot).
4. **Admin, on a company's detail page** (separate admin app):
   - per product: **Hide** (approved → hidden), **Unhide** (hidden → approved), **Delete** (permanent, R2 images first, then the row);
   - the company: **Hide** (approved → hidden), **Unhide** (hidden → approved), **Delete** (permanent: every product image and the logo from R2 first, then the company row, which cascades to its products, contact and memberships). The Clerk account stays; deleting is for removal, hiding is for suspension.
5. **A hidden company stays hidden**: `update_business_listing` keeps `hidden` instead of resetting to `pending` when the supplier edits, and `create_product_submission` already refuses a non approved company. The supplier sees a "hidden by the Exporters Assam team" notice with the contact email.
6. **Freshness**: supplier actions run in the storefront, so they revalidate the affected pages at once. Admin actions run in the separate admin app and cannot revalidate the storefront, so they show within the storefront's 5 minute page cache (decided 2026-09-30).

## Code area
- `supabase/migrations/` (status constraints, `update_product_submission`, `update_business_listing`)
- Storefront: `app/my-products/`, `lib/actions/manage-product.ts`, `lib/supabase/queries/my-products.ts`, `components/product-submission-form.tsx`, `app/list-business/page.tsx`, `app/products/new/page.tsx`
- Admin app (`E:\Web Dev\expoters-assam-admin`): `lib/actions/product-management.ts`, `lib/actions/company-management.ts`, `app/(dashboard)/companies/[id]/page.tsx`, `app/(dashboard)/companies/page.tsx`, new client components for the controls

## Requirements
- AC-1: a supplier sees all their own products, with status and any rejection reason, on My products.
- AC-2: a supplier can edit an own pending, approved or rejected product; it returns to `pending`; a hidden product cannot be edited.
- AC-3: a supplier can delete an own product; its images are removed from R2 and it disappears from the public site.
- AC-4: no supplier can edit or delete another company's product.
- AC-5: an admin can hide and unhide an approved product or company; hidden items are not shown, searchable or enquirable publicly.
- AC-6: an admin can permanently delete a product or a company, removing their R2 images.
- AC-7: editing a hidden company's listing keeps it hidden.

## Ratify
This decision was recorded by /develop, not deliberated. Run `/architect product and company management`
to deliberate and ratify it. Until then it stays flagged as an owed decision; it does not block marking the feature `done`.

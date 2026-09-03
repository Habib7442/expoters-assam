# 0005 · Supplier business listing — rationale

## Context

Scope feature 10 ("Supplier self-service product submission") assumes a supplier already has a `companies` row before they submit a product, but nothing in this repo creates one. Today every company in the directory was either hand seeded (`scripts/seed-demo.ts`) or would need to be added by an admin directly in the separate admin app. Without a self service path, the directory can never grow past what an admin manually types in, which defeats the point of a two sided marketplace.

The schema already anticipated this: `companies.clerk_user_id` is a nullable, `unique` column, and `companies.submitted_by` already distinguishes `'supplier'` from `'admin'`. What is missing is entirely the supplier facing surface: the form, the write path, and the status view, none of which exist in code yet.

A second, smaller gap, confirmed by reading the live migration rather than assumed: `companies.status` currently only allows `('pending', 'approved')`, there is no `'rejected'` value in the database at all, and `products` has a `rejection_reason` column the admin's reject action uses but `companies` does not. If a business listing can be rejected the same way a product can, both gaps need closing together, or a rejection is either impossible at the database layer or a silent dead end with no way to know what to fix.

The consequence of not deciding this now: the "List Your Business Free" buttons already live on the home page (in this session's own earlier build) point at a plain `/sign-up` that leads nowhere meaningful for a supplier, so the site's own call to action currently promises something the product cannot deliver.

## Options considered

### Option 1: Explicit listing form, no auto created stub (chosen)

No `companies` row exists until the supplier completes and submits `/list-business`. Sign up alone creates only the Clerk user, nothing in Supabase.

**Pros**:
- No half filled, abandoned company rows cluttering the admin's approval queue from someone who signed up and never came back.
- No new integration needed: this repo has no Clerk webhook today, and this path needs none.
- Matches the product's own pattern exactly: a product does not exist until it is actually submitted with its required fields; a company should not either.

**Cons**:
- A signed up supplier who never returns to `/list-business` leaves no trace at all, not even a stub the business could later see logged in analytics as "signed up, did not finish listing." That funnel visibility is not designed here.

### Option 2: Auto created stub on sign up

A Clerk webhook creates a minimal, empty `companies` row (name blank or placeholder, `status` some pre pending state) the moment a user signs up, and `/list-business` becomes an edit form for that row.

**Pros**:
- Every signed up supplier has a row from moment one, giving a complete signup to listing funnel to measure.
- A supplier who abandons partway still has a row an admin (or a future reminder email) could act on.

**Cons**:
- Needs a new Clerk webhook this repo does not have (`clerk-webhooks` skill, not yet wired), a real new integration for a benefit (funnel visibility) nothing has asked for yet.
- Introduces a company row with no name, no logo, and no contact number that has to be carefully kept out of every public read path and out of the admin's pending queue until it is actually a real submission, adding a second "is this real yet" state nothing else in the schema has.

## Rationale

Option 1 ships from the schema and patterns this project already has (server actions, `supabaseAdmin` only writes, the same pending/approved shape `products` already uses) with nothing new to build except the form and its atomic write function. Option 2's funnel visibility is a real but currently unrequested benefit that costs a new webhook integration and a second, half real company state to guard everywhere a company is read. Nothing about Option 1 forecloses adding a webhook later if abandonment tracking becomes a real, measured need; it is a strictly additive follow on, not a foreclosed path.

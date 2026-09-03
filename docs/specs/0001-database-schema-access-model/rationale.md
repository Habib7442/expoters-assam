# 0001. Database schema and access model — Rationale

## Context

Neither app has any real data tables yet. `lib/supabase/client.ts` and `lib/supabase/admin.ts` exist in both `expoters-assam` and `expoters-assam-admin`, wired and verified working, but nothing has been written to Supabase itself: no migration, no RLS policy, no table. Every downstream scope feature (the product page, company profiles, listings, buy requirements, supplier submission, membership) reads or writes this same data, so getting the shape and the access rules right here, once, matters more than for an ordinary feature: a schema change after five features are already built against it is a real migration, not an edit.

The central force shaping this decision is that authentication is split from the database in an unusual way for a Supabase project: Clerk manages who is signed in, not Supabase Auth (`AGENTS.md` records this as an already made decision). Supabase's most documented row level security pattern, `auth.uid()` inside a policy, assumes Supabase Auth issued the session; it does not see a Clerk session at all unless something bridges the two. So "how do we let a supplier edit only their own company and products" cannot reach for the textbook Supabase answer without first deciding whether to build that bridge.

A second force is the PRD's own framing of who a buyer is: "every buyer starts as a visitor... the moment they act, they become a buyer, an identified lead saved to the database" (PRD Section 3). This reads as deliberately frictionless, no account, just a name and a phone number at the moment of contact, which shapes both the `buyers` table (no `clerk_user_id`) and the access model (buyers were never going to be a case for per-user RLS in the first place).

A third force is money and durability: membership payments (Razorpay) and every enquiry are the two things this business is built to capture without loss. Both need constraints that hold even under a retried webhook or a careless admin deleting a product (payment idempotency, and enquiries that outlive the row they reference).

## Options considered

### Option 1: Server route checks only, no RLS ownership policies

Every mutation (create a product, edit a company, approve a submission) goes through a Next.js server route or server action that reads the Clerk session, checks it owns the row it's about to touch, then writes using the `supabaseAdmin` service role client, which bypasses RLS entirely. RLS still exists on every table, but only to gate what the public **anon** role can read; it never encodes per user ownership.

**Pros**:
- No new integration to build or operate; both apps already have `supabaseAdmin` wired and working.
- One place (the route handler) to reason about authorization, easy to audit and test.
- Nothing about Clerk's token format or claims needs to be understood by Postgres.

**Cons**:
- The browser can never query Supabase directly on a signed in supplier's behalf; every read of "my own data" also goes through a server route, even ones that would be trivially safe as a direct query.
- Database level defense in depth for ownership is absent; a bug in a route handler's check is not caught by a second layer at the database.

### Option 2: Wire Clerk as a Supabase Third Party Auth provider

Configure Supabase to accept Clerk issued JWTs directly (Supabase's Third Party Auth integration), so `auth.jwt()` inside an RLS policy can read the Clerk user id, and policies like `USING (companies.clerk_user_id = (auth.jwt() ->> 'sub'))` enforce ownership at the database itself. The browser could then query Supabase directly with a supplier's own Clerk token for their own rows.

**Pros**:
- Real database level enforcement of ownership; a route handler bug can't leak another supplier's row.
- Unlocks direct client side Supabase queries later (real time subscriptions, less server route boilerplate) without redesigning access control.

**Cons**:
- A genuine integration project on its own: configuring the JWT template in Clerk, the Third Party Auth provider in Supabase, and testing the claim shape, none of which is done yet in either app.
- Two apps (`expoters-assam`, `expoters-assam-admin`) would each need this wired and kept in sync.
- No feature in the current scope actually needs the browser to query Supabase directly; this is upfront cost for a capability nothing yet uses.

### Option 3: Shadow session in Supabase Auth alongside Clerk

Create a Supabase Auth user for every Clerk user (kept in sync via webhook) so native Supabase RLS (`auth.uid()`) works without any Third Party Auth setup.

**Pros**:
- Uses Supabase's most well documented, most battle tested RLS pattern.

**Cons**:
- A second authentication system running behind the first, exactly what `AGENTS.md` already rules out ("Supabase Auth: Clerk is the chosen auth provider; do not add a second auth system"). Two systems to keep in sync is a durable source of bugs (a user existing in one but not the other), not a one time cost.

## Rationale

Option 2 is the more architecturally complete answer, and `AGENTS.md`'s open decisions section already names it as a real future possibility. But nothing currently in scope (`docs/scope/scope.md`) needs the browser to query Supabase directly: every read the storefront needs (approved products, companies, public buy requirements) is already public and anon readable, and every write is already routed through a server action by nature, an enquiry write must also trigger a WhatsApp forward server side, so it was never a candidate for a direct client write in the first place. Paying the Third Party Auth integration cost now, for a capability nothing uses yet, fails the "boring technology, proven need" bar. Option 1 is also what's already partially wired (`supabaseAdmin` exists in both apps today), so choosing it is finishing what's started rather than a new direction.

Option 3 is rejected outright: it directly contradicts an already made project decision (`AGENTS.md`, "do not add a second auth system"), and the failure mode, two identity systems drifting apart, is worse than the problem it solves.

If a future feature genuinely needs direct client side Supabase access (for example, a live updating supplier dashboard), that is exactly the trigger to revisit this spec and evaluate Option 2 again, not a reason to build it speculatively now.

**Note on the cross check.** An independent model reviewed the first draft of this spec and found a real bug (the `enquiries` table's at-least-one-reference rule was written as a table `CHECK`, which contradicted the `ON DELETE SET NULL` foreign keys it sits beside, and would have made AC-5 fail its own test) plus twenty further gaps: RLS grants that left the tier lookup unreadable by the client that needs it, no phone number normalization, a buyer deletion path that could wipe lead history, missing indexes, and more. None of it changed the core access model decision (Option 1 still stands), but it substantially hardened the schema in `## Feature design`. See the spec's own text for the resolved design; this note exists so a future reader knows the first version had real problems that were caught and fixed, not silently different from what shipped.

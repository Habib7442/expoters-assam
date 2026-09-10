# 0002 · Home page — rationale

## Context

The home page is the storefront's front door. Four of its sections (category grid, featured products, featured exporters, latest buy requirements) were deliberately left as placeholders by the first pass on this spec, because "what makes a product or exporter featured" had no answer anywhere in the schema, the PRD, or `AGENTS.md`. The PRD does gesture at an answer for the future: a paid membership tier is meant to grant "ranking boost, featured placement" (scope feature 11), but that feature is itself still undecided and unbuilt, so it cannot be the source today.

A second, smaller gap surfaced while tracing where each section's values come from: `companies` has no `approved_at` column (only `products` does), and even `products.approved_at` is not currently being set by any code path in this repo. A "most recently approved" rule has to account for both.

The consequence of not deciding: the home page keeps shipping placeholder numbers and empty sections indefinitely, which undersells a directory that already has real, working data behind it (feature 4's product page and enquiry flow are live).

## Options considered

### Option 1: Most recently approved (chosen)

Order Featured Products and Featured Exporters by `created_at desc, id asc`, capped at the section's limit. The named intent was approval recency, but neither table is actually ordered by an approval timestamp today (see Cons); switching Products to `approved_at` is a Follow-up once the separate admin app populates it, not the current contract. No new column, no manual step.

**Pros**:
- Always has content the moment there is any approved data, nothing to curate by hand.
- Zero schema change, reuses timestamps the schema already tracks.
- A clean seam to layer a tier based boost onto later, once scope feature 11 (membership) exists, without touching the section's shape.

**Cons**:
- Not actually a merit based "featured" in the marketing sense; a supplier who has been live for a year with excellent products gets no boost over one approved yesterday.
- `products.approved_at` is not currently populated by any code path in this repo, so today this is effectively ordering by `created_at` for products too, until an approval action starts setting it.

### Option 2: Manual admin flag

Add an `is_featured` boolean to `products` and `companies` that only the separate admin app can set.

**Pros**:
- Real editorial control: the business can put its best foot forward deliberately.
- Matches how most B2B directories actually curate a homepage.

**Cons**:
- Needs a second, coordinated change in the separate admin app (`expoters-assam-admin`) before it does anything; until then the flag sits false on every row and the sections stay empty.
- A genuinely new decision about who sets it and when, which stalls this pass rather than closing it.

### Option 3: Verified + recency blend

Order by `companies.verified = true` first, then recency as the tiebreaker.

**Pros**:
- Rewards suppliers the business has already vetted, a real (if coarse) merit signal.
- Still needs no new column.

**Cons**:
- `verified` is a boolean the admin app sets by hand today with no documented criteria in this repo, so the "merit" it signals is only as good as that unwritten process.
- Products have no equivalent verified concept, so this option only cleanly answers Featured Exporters, not Featured Products.

## Rationale

Option 2 (manual flag) is the more "correct" long term answer but depends on a coordinated change in the separate admin app this repo does not own, which would stall the home page indefinitely on a cross repo dependency for a placeholder that has already sat unbuilt since the first pass on this spec. Option 3 only answers half the question (exporters, not products) and rests on an admin judgement call (`verified`) that has no documented criteria anywhere in this repo. Option 1 is the only one that ships today from data the schema already has, and it does not foreclose Option 2 or 3 later: scope feature 11's PRD language ("ranking boost, featured placement") is the natural trigger to revisit this ordering once memberships exist (see Follow up).

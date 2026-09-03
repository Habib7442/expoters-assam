# 0003. Product page and Send Enquiry — rationale

## Context

This is the walking skeleton for the entire product: the scope calls it "the core loop," the first real, narrow, end to end slice that every other feature builds on. Spec 0001 already locked the database schema and access model (all seven core tables, RLS, the server route mediated write pattern) but deliberately left two things open for whichever feature needed them first: how a supplier's WhatsApp contact number is stored (no table has a phone-like column for a company), and how a product is addressed in a URL (no `slug` column exists, only `categories` has one). This feature is the first to need both, so it resolves them here rather than leaving them for `/develop` to invent.

An independent cross check of an earlier draft (see *Cross check findings* below) found that draft's approach to the WhatsApp number, a plain column on `companies` with a column level `REVOKE`, does not actually work in Postgres against the table level `GRANT` spec 0001's own migration already runs: column privileges are additive, not subtractive, so the revoke would have been a silent no-op and every supplier's WhatsApp number would have stayed publicly readable. The design in `index.md` uses a separate `company_contacts` table with RLS and no policy instead, the same structurally-unreadable pattern spec 0001 already uses for `buyers`/`memberships`/`enquiries`. That fix carries forward unchanged through the later pivot described below.

Rate limiting is called out by name in spec 0001's own Follow-up: "the feature spec that defines them (scope feature 4) must not skip it." This spec treats that as a hard requirement, not an optional nice-to-have.

**A later pivot, after the WhatsApp provider decision below was first made and confirmed:** the engineer reversed course on using any WhatsApp API at all, server-side or through a BSP. The reasoning wasn't stated in detail, but the practical effect is the same regardless of the reason: no message credential, no per-message cost, no external approval process, and no server ever calling out to WhatsApp on this project's behalf. Everything about the schema, the rate limiting, and the security model below was designed for the API approach and turned out to still hold with only the WhatsApp-sending mechanism itself replaced; `## Options considered` documents both the original three-way provider comparison this spec started from and the two-way comparison (click-to-chat vs. any API) that replaced it.

Consequence of not deciding: without a place to store a supplier's WhatsApp number, "Send Enquiry" has no destination; without a slug, the product page has no clean, stable URL; without deciding how the buyer actually reaches WhatsApp, the enquiry write can be built but nothing connects the two sides of the conversation.

## Options considered

**The decision now in force** is between two fundamentally different mechanisms, not between WhatsApp API providers:

### Option 1: Click-to-chat (`wa.me`), buyer initiated — chosen

The server never calls WhatsApp at all. It returns a `wa.me/<number>?text=<message>` link; the buyer's own device opens their own WhatsApp app with the message pre-filled, and they tap send themselves.

**Pros**:
- Zero cost, zero credentials, zero external approval process. Can be live the moment the code ships.
- The buyer's real name and number reach the supplier automatically, as the actual sender of a real WhatsApp message, with nothing for either side to type in or trust.
- No vendor in the path at all, so no vendor to migrate off of later.

**Cons**:
- No delivery or read confirmation. The platform can prove it offered a working link; it cannot prove the buyer sent it, or that the supplier read it.
- Depends on the buyer completing one more manual step (opening the link, tapping send) rather than the platform doing it on their behalf; some drop-off between "enquiry saved" and "message actually sent" is invisible and unavoidable.
- On desktop, `wa.me` only works if the buyer already has WhatsApp Web linked to their phone.

### Option 2: A WhatsApp Business API, direct or through a BSP (business solution provider)

The server itself sends the message, via Meta's Cloud API directly or a reseller (Wati, AiSensy, and others were compared in an earlier pass of this decision).

**Pros**:
- The platform, not the buyer, guarantees the message is sent (subject to the API's own delivery guarantees); a `whatsapp_forwarded_at` timestamp means something closer to "delivered," not just "offered."
- Works identically regardless of whether the buyer is on the device that receives the link.

**Cons**:
- Every option in this category needs a Meta-approved message template, since this is a business-initiated message outside any existing conversation; template approval is external and outside engineering's control (Meta direct: also a multi-week business verification before the account can send anything live).
- A direct Meta integration costs real per-message money at any volume beyond the free tier; a BSP adds a recurring platform fee on top of that.
- Either path is more to build, configure, and operate than a plain link: credentials, a send contract, timeout handling, retry/failure bookkeeping.

## Rationale

The original recommendation, when this decision was first designed, was Wati (a BSP) over Meta's Cloud API direct, specifically because the feature's job is to prove the whole pipe works end to end as fast as possible, and Meta's own business verification sits directly astride that goal. The engineer chose Meta direct instead at that time, accepting the verification wait as the cost of the cleanest long term architecture.

That whole tradeoff is moot now: the engineer subsequently ruled out every option in the API category (Option 2), for reasons not detailed in this conversation. Click-to-chat (Option 1) is the only option left standing, and on its own merits it is a reasonable, arguably better fit for a first slice specifically because it removes every one of Option 2's real costs (money, credentials, an external approval clock) in exchange for one honestly stated limitation: the platform cannot prove a buyer completed the WhatsApp step, only that it offered them a working way to. AC-3 is worded to reflect exactly that, rather than overclaiming delivery the design cannot actually guarantee.

The smaller stack picks made in the same design pass, unaffected by the WhatsApp mechanism change and still asked and confirmed with the engineer rather than silently decided:
- **Rate limiting**: checked against the existing `enquiries`/`buyers` tables (a phone's enquiries in the last hour) rather than a new dedicated counter table, since the existing schema already carries everything the check needs (basis: reuse over new infrastructure, and spec 0001's own `buyers.phone` uniqueness). The cross check found the original two-round-trip version of this idea raced under concurrent requests; the final design folds the count, a duplicate check, and the insert into one `create_enquiry` SQL function so no two requests can race each other.
- **Form submission**: a Next.js server action with `zod` validation, the framework's native pattern, over a separate API route (basis: `AGENTS.md`'s Next.js App Router convention; server actions are the idiomatic mutation path in this stack).
- **Send Enquiry UI**: a modal dialog (shadcn's `dialog`, not yet installed) over reusing the existing `Sheet` or an inline page section, because a centered modal is the standard, expected pattern for this exact "click a CTA, fill a short form, done" interaction, and the cost of adding one more small shadcn component is low.
- **Product URL**: a `slug` column added now rather than shipping with raw UUIDs in the URL, because this is a publicly indexed page and retrofitting clean URLs later is a breaking change to every link ever shared, far more expensive than a small schema addition today.

## Cross check findings

An independent model (a different, more capable model than the one that wrote the first draft) reviewed an earlier draft, built against the WhatsApp API design, before it was shown to the engineer, per this project's GA workflow tier. It found that draft was buildable but wrong in three material ways, and under-specified in enough smaller ways that `/develop` would have had to invent them. The findings that concerned the database schema, RLS, rate limiting, and slug generation all carry forward unchanged into the current click-to-chat design (the WhatsApp API-specific findings do not apply any more, since that whole mechanism was later replaced):

- **A real security hole**, still fixed the same way: the column level `REVOKE` originally planned for the WhatsApp number was a silent no-op against the table level `GRANT` spec 0001's migration already runs. Fixed by moving the number to its own `company_contacts` table, RLS enabled, no policy — this remains the design regardless of how the number is eventually used.
- **Two race conditions**, still fixed the same way: the rate limit (count-then-insert in two round trips) and the slug generation (check-then-insert) were both check-then-act races that a concurrent request could slip through, which would have failed their own acceptance criteria and test scenarios as originally drafted. Fixed by folding the rate limit, a duplicate check, and the insert into one `create_enquiry` transaction with an advisory lock, and by adding a retry-on-collision loop to slug generation instead of a plain pre-check.
- **An unenforced authorization gap**, still fixed the same way: nothing in the earlier draft stopped `sendEnquiry` from being called with a `pending` or `rejected` product's id directly (bypassing the UI), since the write path uses `supabaseAdmin` and bypasses RLS. Fixed by making the approval check part of `create_enquiry`'s own `WHERE` clause (AC-8), not an assumption about which client the read side uses.
- *(No longer applicable, superseded by the pivot away from any WhatsApp API):* about a dozen smaller decision gaps the cross check found in the Meta Cloud API call itself (API version, template body, sanitization, timeout handling, unconfigured-env behavior). None of that mechanism exists in the current design; there is no API call to under-specify.
- A handful of smaller gaps unrelated to WhatsApp (an approved product whose company is not approved, the demo seed script's runner, type regeneration missing from the build plan, the image storage domain for `next/image`, and others) are folded directly into the relevant `index.md` sections above and remain unaffected by the pivot.

## References

**Project sources** (verifiable, in this repo):
- `AGENTS.md`, Section 6, listing the WhatsApp integration provider as an explicit open decision (this spec closes it, though not by picking a provider)
- Spec 0001 (`docs/specs/0001-database-schema-access-model/`), the data model and `buyers.phone` normalization pattern this spec extends; and its own "no policy at all" RLS pattern for `buyers`/`memberships`/`enquiries`, which `company_contacts` reuses (its Security model section)
- Spec 0001's Follow-up, explicitly requiring this feature not skip rate limiting
- `supabase-postgres-best-practices` (`.claude/skills/supabase-postgres-best-practices/`), consulted for RLS and trigger based normalization conventions

**Practices & standards**:
- Rate limiting on public write endpoints (OWASP API security guidance)
- RLS with no policy at all, not a column level privilege, as the robust Postgres pattern for "most of a table is public, one part of it is not" — a policy-less table is unreadable under every query shape (a `select('*')`, a join, a future view), where a column privilege depends on every future query remembering to list columns explicitly
- `wa.me` click-to-chat links as WhatsApp's own documented, credential-free way to start a conversation from a web link

**Links** (web verified during this design's original WhatsApp API landscape check, kept for the historical record even though that mechanism was later dropped):
- Meta WhatsApp Cloud API, Get Started: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- WhatsApp Business API Pricing in India 2026 (MyOperator): https://myoperator.com/blog/whatsapp-business-api-pricing-india-2026
- WhatsApp API Pricing India 2026, BSP Comparison (Codingclave): https://codingclave.com/guides/whatsapp-api-pricing-india-2026-comparison

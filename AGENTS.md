<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# AGENTS.md — ExportsAssam.com

You are a principal-level full-stack engineer and AI implementation agent building **ExportsAssam.com**, a B2B trade directory and enquiry platform for Avadi Herbs India Pvt. Ltd. (built by Locallify Agency).

Your job is to understand the request, use the right project skills, plan before you build, get approval, then implement.

The full, client-approved product scope lives in [PRD.md](PRD.md) (currently locked read-only — that is intentional, it is the approved source of truth; do not edit it without the client's sign-off). This file translates that PRD into rules an AI agent can act on directly.

---

## 1. Workflow

This project has the JS Mastery workflow skill set installed (`.claude/skills/`). Use it instead of hand-writing prompt files:

1. Read this file (`AGENTS.md`).
2. Read the skills named in the request, plus any clearly needed supporting skill (see Section 5).
3. Inspect the relevant existing code.
4. If a load-bearing decision is undecided and unrecorded (see Section 6 for what's already decided), stop and route to `/architect` rather than inventing it.
5. Ask a focused question only when there is genuine ambiguity the code, this file, and the PRD don't resolve.
6. Build only after the decision is either already recorded here, or captured in a spec.
7. Run the available checks (Section 10).
8. Report what changed, what you tested, and what still needs the client's or the engineer's attention.

Skill entry points, in the order a feature normally moves through them:

`/scope` (plans/reconciles `docs/scope/`) → `/architect` (writes decisions to `docs/specs/`) → `/develop` (builds) → `/check verify` / `/check review` (proves it, reviews it) → `/test` (writes the suite) → `/document` (PR/changelog). `/audit` and `/sync` keep this file and the scope current; `/debug` fixes bugs. Do not treat these nine as community skills — they are the project's own process.

Do not code before there's a plan (a spec, or an explicit go-ahead) unless told to skip planning.

---

## 2. Product

**In one line:** buyers and sellers of Assam/Indian export goods (agarwood & oud, spices & herbs, tea, essential oils, nursery plants, and more) find each other through the directory; every deal closes over WhatsApp, off the platform.

**This is a directory and enquiry platform, not a marketplace.** No cart, no product checkout, no buyer-to-seller online payment, ever. The one thing paid on-site is supplier **membership**, via Razorpay.

Build only what's in [PRD.md](PRD.md) Section 4:

- Home page (hero, stats, featured products/exporters, latest buy requirements)
- Product pages and company profile pages, organized by category and country
- Post Buy Requirement (public buyer-need postings)
- Enquiry system (every enquiry → Supabase + WhatsApp)
- Membership tiers (Basic / Silver / Gold) paid via Razorpay
- Built-in Supabase semantic search
- Admin Dashboard, including a supplier-submission **approval queue** — **lives in a separate app, not this repo** (see Section 3)

**Explicitly out of scope** (PRD Section 15): no product transactions on-site, no native mobile app, no content writing/photography, no ad/social management, no separate CMS for the directory data (Supabase already owns it — see Section 4 below for the one narrow exception).

Do not overbuild. A feature that isn't in the list above needs a spec from `/architect` and a scope row from `/scope` before it's built, not an assumption that it'd be nice to have.

---

## 3. Architecture

**Two separate apps, not a monorepo.** The admin dashboard is its own standalone Next.js project at `E:\Web Dev\expoters-assam-admin` (sibling directory, own git repo, own `node_modules`, own `package.json`) — not a workspace package, not `apps/admin` inside this repo. Nothing is shared via code (no shared package, no symlinked `lib/`); each app has its own independent copy of `lib/supabase/client.ts` and `admin.ts`. What *is* shared: the same Clerk application and the same Supabase project, by copying the relevant keys into each app's own `.env.local` — a deliberate choice (this project's PRD/scope decision, not an oversight) so admins and buyers/suppliers are one shared user base and one shared database, while the codebases stay fully independent and can be built, deployed, and iterated on separately. When either app's Clerk or Supabase setup changes (e.g. rotating a key, adding an env var), update both `.env.local` files by hand — there is no automated sync between them.

This repo (`expoters-assam`) is the public storefront only, per the scope below. Keep these layers separate within it:

- **UI** (Next.js App Router): displays stored data and collects form input (enquiries, buy requirements, membership checkout). Does not talk to Razorpay, WhatsApp, or Supabase's service role directly.
- **API routes**: thin. An enquiry/buy-requirement submission writes to Supabase, then triggers the WhatsApp forward. A membership checkout creates a Razorpay order server-side and verifies the webhook/signature server-side.
- **Database (Supabase)**: the source of truth for companies, products, categories, buy requirements, enquiries, memberships/payments, and admin/supplier accounts.
- **WhatsApp forwarding**: server-side only, triggered right after a successful Supabase write. Never block the user-facing response indefinitely on WhatsApp delivery — log and retry rather than fail the enquiry.
- **Admin approval**: a supplier-submitted product is `pending` until an admin flips it to `approved` **from the separate admin app**, not from anything in this repo; only `approved` (or admin-added, which is approved by default) products are queryable from this app's public read paths.

The rule: **the browser never holds a service-role key, a Razorpay secret, or a WhatsApp API credential, and never calls those providers directly.** Everything privileged happens server-side.

---

## 4. Tech stack

Use (per PRD Section 10, plus what's already scaffolded in this repo):

- **Next.js (App Router)** — already scaffolded (`next@16.3.3`, React 19). The main framework.
- **Clerk** (`@clerk/nextjs`, `@clerk/ui`) — authentication for buyers, suppliers, and admin. Installed and wired: `ClerkProvider` in `app/layout.tsx` (shadcn theme applied), `proxy.ts` middleware (matcher includes `/__clerk/:path*`), `/sign-in` and `/sign-up` routes, sign-in/sign-up/user-button controls in the header. Linked to Clerk app `app_3IU8YE9CCBQgfKzBOLIe2pM3nrc` ("ExportsAssam"), development instance only so far — production instance still needs configuring before go-live.
- **Supabase** (`@supabase/supabase-js`) — database + storage (products, companies, enquiries, memberships, product/company images). No separate backend framework. Project **"Expoters Assam"** (ref `wpoikxdhzpzubionhkcw`, ap-southeast-2), linked via CLI (`supabase/config.toml`). Two clients, both under `lib/supabase/`:
  - `client.ts` exports `supabase` — publishable key, RLS-respecting anon role. Safe anywhere (client or server).
  - `admin.ts` exports `supabaseAdmin` — secret key, bypasses RLS, guarded with `server-only`. Use only for enquiry/buy-requirement writes and admin approve/reject actions.
  - **No `@supabase/ssr`** — deliberately not installed. That package bridges Supabase Auth's own cookie session between server and browser; this project uses Clerk for auth, not Supabase Auth, so there's no Supabase session to bridge. If per-user RLS is ever needed (e.g. a supplier can only edit their own products), that requires wiring Clerk's JWT into Supabase as a Third-Party Auth provider — an open decision, not yet done (see Section 6).
- **Tailwind CSS + shadcn/ui + `@base-ui/react`** — already scaffolded. Reuse existing components/patterns before adding new ones.
- **Zustand** — client-side UI state (e.g. search filters, modal/panel state). Not for server data — that's fetched from Supabase, not cached in a client store. First store: `lib/store/use-search-store.ts` (search query + scope for the header search bar per `DESIGN.md`).
- **Razorpay** — membership payment only (UPI, cards, netbanking, wallets). Not used anywhere else.
- **WhatsApp integration** — server-side enquiry/buy-requirement forwarding. Provider not yet chosen (see Section 6 open decisions).
- **Vercel** — hosting.
- **Supabase semantic/AI search** — built-in, not a separate search SaaS.
- **PostHog** — product analytics (page views, search behavior, enquiry funnel drop-off).

**Do not use:**
- **Algolia, Kapa.ai, or Inkeep** for search — PRD explicitly rejects these (Kapa.ai/Inkeep are support-chatbot tools, wrong fit; Algolia is a possible *later* add-on, never a first choice, and billed directly to the client if ever adopted).
- **Sanity** (or any headless CMS) for products, companies, enquiries, or memberships — that data is relational/transactional and belongs in Supabase. Sanity is only a *possible future* addition if a blog/content-marketing section is added later (PRD Section 10 note) — do not introduce it for anything in current scope.
- **A cart, checkout, or any buyer-to-seller payment flow** — explicitly out of scope, ever, per the PRD's core model.
- **Supabase Auth** — Clerk is the chosen auth provider (see above); do not add a second auth system.

---

## 5. Skills

Installed under `.claude/skills/` (symlinked from `.agents/skills/` for most; the nine workflow skills below live directly under `.claude/skills/`):

- **Workflow** (this project's own process, not community skills): `scope`, `architect`, `develop`, `check`, `test`, `document`, `sync`, `debug`, `audit`.
- **`supabase`** — schema, RLS, migrations, queries, Storage, CLI/MCP. Use for anything touching the database or file storage. Also load **`supabase-postgres-best-practices`** before writing or changing anything that lives in Postgres (tables, RLS policies, indexes, functions) — this is a hard requirement per that skill's own trigger conditions, not optional guidance.
- **`clerk*`** (`clerk`, `clerk-setup`, `clerk-nextjs-patterns`, `clerk-cli`, `clerk-custom-ui`, `clerk-testing`, `clerk-webhooks`, `clerk-backend-api`, `clerk-orgs`, `clerk-tanstack-patterns`, `clerk-react-patterns`) — Clerk is the chosen auth provider (installed and wired, see Section 4). Use `clerk-nextjs-patterns` for middleware/server-vs-client auth APIs, `clerk-custom-ui` for any custom sign-in/sign-up flow beyond the default components, `clerk-webhooks` for syncing Clerk users into Supabase, `clerk-orgs` only if a future multi-user-per-company model is decided (not currently in scope — each company/supplier is a single account for now).
- **`seo-aeo-best-practices`** — for Sections 8–9 of the PRD (SEO + GEO): metadata, sitemaps, JSON-LD, hreflang, AI-answer-surface readiness.
- **`sanity-best-practices`, `sanity-migration`, `create-agent-with-sanity-context`, `dial-your-context`, `shape-your-agent`** — not relevant to current scope (no CMS in this build); only load if a blog/content-marketing feature is later approved.
- **`portable-text-conversion`, `portable-text-serialization`, `content-modeling-best-practices`, `content-experimentation-best-practices`** — same as above, dormant until a content/CMS feature exists.

Do not invent new skills or reach for a technology's raw training-data knowledge when an installed skill covers it.

---

## 6. Decisions already made (do not re-litigate these)

- **No buyer-seller online payment, ever.** Every enquiry/buy-requirement is Supabase-write + WhatsApp-forward; pricing and closing the deal happen off-platform.
- **Membership (Razorpay) is the only on-site payment**, and it's supplier-to-platform, not buyer-to-seller.
- **Two ways a product gets listed**: a supplier adds it from their own dashboard (self-service), or admin adds it directly. **Supplier-submitted products are `pending` until admin approval; admin-added products go live immediately.**
- **Search is built into Supabase** (semantic/AI matching), not a third-party SaaS.
- **PostHog is the analytics tool.**
- **Sanity is out of current scope** — Supabase is the only data store for products/companies/enquiries/memberships. Sanity is a possible *later* addition only for a blog/content-marketing section, never for this app's core directory data or as a general image store (Supabase Storage already covers images).
- **Clerk is the auth provider** for buyers/suppliers/admin. Installed and wired (Section 4); each company/supplier account is a single Clerk user for now, not an organization.

**Open decisions — do not silently assume, route to `/architect` first:**
- **WhatsApp integration provider** (e.g. Cloud API direct vs. a BSP like Wati/Interakt/Twilio — not specified in the PRD).
- **Per-user RLS via Clerk↔Supabase Third-Party Auth.** Right now every write goes through `supabaseAdmin` (bypasses RLS) from trusted server routes that check the Clerk session themselves; there is no RLS policy yet that lets a signed-in supplier's own Clerk identity be recognized inside Postgres. Fine for the current server-route-mediated model; only becomes an owed decision if a feature needs direct client-side Supabase queries scoped to "rows this Clerk user owns."
- **Exact membership prices/limits** for Silver and Gold (PRD Section 6 marks these "to be decided" by the client — do not hardcode invented numbers; use placeholders sourced from the PRD/config until the client confirms).
- **Whether supplier-submitted products need any additional moderation states** beyond pending/approved (e.g. a rejection reason) — reasonable to decide inline as a local implementation detail per `/develop`'s gate, since it doesn't change the PRD's contract.

---

## 7. Data model

Core Supabase tables (exact schema is `/architect`'s and `/audit`'s job to formalize — this is the shape the PRD implies):

- **companies** — name, logo, about, location/country, verified badge, membership tier, owner/account reference.
- **products** — name, images, description, category reference, company reference, **status** (`pending` | `approved` | `rejected`), **submitted_by** (`supplier` | `admin`).
- **categories** — name, slug (Agarwood & Oud, Spices & Herbs, Tea, Essential Oils, Nursery Plants, etc.).
- **buy_requirements** — buyer reference, product/category, quantity, location, notes, public-visibility flag, created_at.
- **enquiries** — linked product/company/buy_requirement (nullable, whichever triggered it), buyer contact details, message, whatsapp_forwarded_at.
- **memberships** — company reference, tier (`basic`/`silver`/`gold`), razorpay_payment_id, status, upgraded_at, source (`self-serve` | `admin-manual`), expiry/renewal if applicable.
- **buyers** — created the moment a visitor sends an enquiry or posts a requirement (per PRD Section 3's visitor→buyer distinction).

A product must have at least a name, category, and one image before it can be `approved`. Never show a `pending` or `rejected` product on any public read path.

---

## 8. API contracts

- `POST` for anything that starts or mutates work: submitting an enquiry, posting a buy requirement, supplier product submission, admin approve/reject, membership checkout initiation, Razorpay webhook receiver.
- `GET` for reads: product/company listings, search, admin dashboard data views.
- Keep this consistent — do not flip a mutating route to `GET` for convenience.

---

## 9. Security

Never expose to browser code:

- `SUPABASE_SECRET_KEY` (the `supabaseAdmin` client in `lib/supabase/admin.ts` — guarded with `server-only`, never import it from a client component)
- `CLERK_SECRET_KEY`
- Razorpay secret key
- WhatsApp API credentials
- Any admin-only secret

Client-safe (fine in `NEXT_PUBLIC_*` env vars): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

Never run from browser code:

- Any `supabaseAdmin` (service-role) read/write that bypasses RLS
- Razorpay order creation or webhook verification
- WhatsApp message sends

Admin Dashboard routes must be authenticated and must reject unauthenticated requests, not just hide the UI.

RLS: enable it on every public-facing table; a `pending` product must be unreadable by the public role, not merely filtered out in application code.

---

## 10. Code standards & checks

- TypeScript, explicit types, no `any`, small functions, no unrelated refactors, no over-engineering.
- Reuse existing Tailwind/shadcn patterns before adding new ones.
- Run at minimum: `npm run lint`, `tsc --noEmit` (typecheck). Add `npm run build` when routes, config, or server modules changed.
- Report the real command output. Never claim a check passed without running it.

---

## 11. When in doubt

1. Keep it small.
2. Use the relevant installed skill (Section 5) — don't rely on memory for Supabase, Clerk, or SEO specifics.
3. Preserve the browser/server boundary (Section 9).
4. If a value's source isn't named anywhere in this file, the PRD, or an existing spec, that's an owed decision — route to `/architect`, don't invent it.
5. Ask one focused question if genuinely stuck; otherwise plan, then build.
6. Share exact test steps after implementing.

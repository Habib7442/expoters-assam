# 0002 · Home page: navbar and hero

**Status**: Assumed
**Date**: 2026-08-27
**Authorized by**: engineer, during /develop

## Owed decision
Feature 7 (Home page) in the scope is flagged `needs a decision` and has no spec yet — the full page (hero, stats, featured products/exporters, latest buy requirements, why-us band, newsletter, footer) has not been through `/architect`. The engineer asked to build just the navbar and hero now, pasting a complete written brief (exact section order, copy, colors, CTAs) plus three reference screenshots for visual mood only (card style, spacing, airy feel), not for pixel replication. That brief resolves the composition/copy/component-inventory questions `/architect` would normally ask for this slice, so this spec records it rather than inventing it silently.

## Assumption built on
Scope for this build: **top bar, sticky header/navbar, category chips row, and hero section only.** The remaining Home page sections (Shop From Top Categories full grid, Featured Products, Featured Exporters, Latest Buy Requirements, Why ExportsAssam, Newsletter, Footer) are explicitly out of scope for this pass and stay owed — either a follow-up `/develop` against an extended version of this spec, or a full `/architect home page` pass if the engineer wants the data-backed acceptance criteria (real Supabase counts/content) designed properly first.

Brief, as given:
- Slim top bar, `--green-wash` background: "Connecting Assam to the World" tagline left; language/country selector right. (No social icons: this lucide-react version ships no brand icons, and adding a new icon package for a decorative row is out of scope — dropped rather than silently pulling in a dependency.)
- Sticky header, white background: text logo "ExportsAssam" left (no logo asset provided yet); nav links Products / Companies / Buy Leads / Membership; a large white search bar with a scope dropdown (Products / Companies / Buy Leads) and a solid green search button (UI only — no wiring, the routes and search backend don't exist yet, this is Feature 4/6/12's job); "Sign In" (existing Clerk `SignInButton`) and a solid green "List Your Business Free" button (routes to `/sign-up`) when signed out; existing Clerk `UserButton` when signed in.
- Category chips row under the header: Agarwood Inoculation, Live Plants, Spices, Essential Oils, Tea, Handicrafts. Static for now (no active-filter state — Feature 6 owns real filtering).
- Hero on a `--green-wash` rounded block: heading "India's Gateway to Global Trade", sub-line "Connecting Assam to the world", two CTAs (solid green "Post Buy Requirement" → `/buy-requirements/new`, green-outline "List Your Business Free" → `/sign-up`), a stats strip (Verified Exporters, Products, Global Buyers, Countries — placeholder numbers, real counts are Feature 7's full-page data job), and a blank placeholder area on the right for a product/plant image (engineer will add the real image later — do not invent or source one).
- Colors and type: reuse the tokens already applied in `app/globals.css` / `DESIGN.md` (`--green` #2E7D32, `--green-deep` #14532D, `--green-wash` #E4EFD4, `--bg-soft` #F6FAF0, `--text` #1A1F1A), Sora for the heading, Inter for body/UI. No new tokens invented.
- Mobile-first, airy, generous whitespace, matching the already-approved design system (`.claude/skills/develop/design.md`).

## Code area
`app/layout.tsx` (replaces the current bare Clerk-only header with the top bar + sticky navbar, site-wide), new `components/site-header.tsx`, `app/page.tsx` (category chips + hero, replacing the tokens demo section built in the prior `design system tokens` pass).

## Requirements
- AC-1: Every page shows the slim top bar and sticky white header with logo, the four nav links, the search bar (scope dropdown + button, non-functional), and the signed-out/signed-in auth controls.
- AC-2: The home page shows the category chip row and the hero block (heading, sub-line, two CTAs, stats strip, blank image placeholder) styled on `--green-wash` per the brief.
- AC-3: All colors, radii, and fonts come from the existing tokens (`app/globals.css`) — no new hardcoded hex values.
- AC-4: Responsive: the header collapses sensibly on mobile (nav links and search bar don't overflow), the hero stacks single-column on small screens.

## Ratify
This decision was recorded by /develop, not deliberated. Run `/architect home page` to deliberate and ratify the full Home page (including the sections this pass deliberately left out, and the real-data acceptance criteria). Until then it stays flagged as an owed decision; it does not block marking the navbar/hero sub-task `done`.

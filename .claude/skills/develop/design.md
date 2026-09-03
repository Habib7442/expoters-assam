---
name: exportsassam-light-natural
source: reference:DESIGN.md
character: "Fresh, natural, premium and clean — a light, airy 'Assam's finest, to the world' feel. Soft green accents, crisp product photography on light backgrounds, a small gold accent reserved for premium/membership moments."
tokens: "real values live in app/globals.css (:root); read them there, never duplicated here. Font pairing wired in app/layout.tsx (Inter body / Sora heading)."
contrast: "body (#5B6B57) on background (#FFFFFF): 5.7:1 · primary text (#1A1F1A) on background: 17.6:1 · primary-foreground (#FFFFFF) on primary (#2E7D32): 5.1:1 — all pass WCAG AA"
---

## Build mandate
You are a senior product designer. Every page ships as a complete, professional product surface: brand, real product specific copy, a considered layout with hierarchy, all states (empty, loading, error), supporting content, and a footer where the page warrants one. Maximalist, never a lone form on an empty page. Full disqualifier list: the UI guide's bar.

## Character & direction
White and soft-green throughout; green (`--primary` / `--green`) is the one accent for actions and trust signals (verified badges, primary buttons), gold (`--gold`) is a tiny premium-only accent (Gold-member badge) and must never dominate a surface. Never a dark or black page background — this brand is light-only, DESIGN.md forbids it explicitly, so this project does not carry a dark theme (the scaffolded `.dark` block in `app/globals.css` is inert leftover, not wired to any toggle).

## Composition patterns
Generous whitespace, max content width ~1200px centered, 12-column responsive grid, mobile-first. Alternate white and `--bg-soft`/`--green-wash` section bands for rhythm: bold heading (Sora, `--green-deep`) + short muted sub-line + content.

## Component & usage rules (do's and don'ts)
- Cards: `rounded-2xl`, white fill, soft low shadow, 1px `--border`. Featured cards may sit on a `--green-wash` block.
- Primary buttons: solid `--green`/`--primary`, white text, `rounded-full` or `rounded-xl`. Secondary: white fill, `--green` border and text.
- Tags/pills (e.g. "Verified", membership tier): `--green-wash` background with `--green-deep` text; gold pill reserved for Gold membership only.
- Headings use `font-heading` (Sora); body and UI text use `font-sans` (Inter).
- Don't: dark/black backgrounds, cream+brass-gold flood, gold as a dominant color, light green text on white.

## Responsive & accessibility direction
Contrast ratios above hold for both body and button text; keep any new text/background pairing at or above them. No project-specific responsive direction beyond the implementation defaults (mobile-first, most buyers are on phones).

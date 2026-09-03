# DESIGN.md — ExportsAssam.com Design System (Light / Natural)

> Paste this into Stitch (or upload it) as the project design system so every screen stays on-brand. Also upload the Avadi logo as an image reference. Keep hex codes exact — restate them in individual prompts to prevent color drift.

## Brand personality
Fresh, natural, premium and clean — a light, airy "Assam's finest, to the world" feel. Lots of white space, soft green accents, crisp product photography on light backgrounds. Think a modern natural-products brand (herbs, live plants, spices) — trustworthy and premium, never cluttered or dark. Green = nature/authenticity; a touch of gold = premium quality.

## Color tokens (use these exact values)
- `--bg` #FFFFFF — page background (white)
- `--bg-soft` #F6FAF0 — very soft green-tinted section background
- `--green-wash` #E4EFD4 — soft green hero/section blocks (like the reference)
- `--surface` #FFFFFF — cards (white) with soft shadow
- `--green` #2E7D32 — primary brand green (buttons, key accents)
- `--green-deep` #14532D — headings, dark green text, hover
- `--leaf` #7CB342 — lively accent, highlights, active chips
- `--lime` #A5D566 — soft highlight / success wash
- `--gold` #B8862F — SMALL premium accent only (Gold-member badge, tiny highlights). Do NOT flood with gold.
- `--text` #1A1F1A — primary body text (near-black, warm)
- `--text-muted` #5B6B57 — secondary text (greenish grey)
- `--border` #E3E9DC — hairline borders / dividers

Primary buttons: solid `--green` #2E7D32 (or `--green-deep` on hover), white text, rounded-full or rounded-xl.
Secondary buttons: white with `--green` border and green text.
Action button ("Send Enquiry"): solid `--green`; success/verified uses `--leaf`/`--lime`.
Never use a dark/black page background. Never use cream/beige + brass-gold as the dominant palette — this is white + fresh green.

## Typography
- Headings: a bold, modern, slightly geometric sans — "Sora", "Poppins" (semibold/bold) or "Clash Display". Confident and friendly, often in `--green-deep`.
- Body & UI: clean sans — "Inter" or "Manrope". Comfortable line-height.
- Optional accent: a tasteful italic for a single hero sub-phrase (like the reference) — use sparingly.

## Layout & spacing
- Very generous whitespace; airy and light. Max content width ~1200px, centered.
- 12-column responsive grid. Mobile-first — most buyers are on phones.
- Cards: rounded-2xl (16–20px), white fill, soft shadow (low, diffuse), 1px `--border`. Featured cards can sit on a `--green-wash` block.
- Section rhythm: alternate white and `--bg-soft`/`--green-wash` bands to create gentle structure. Bold heading + short muted sub-line + content.

## Components
- **Product card:** product image on white/very-light bg (rounded top), product name (bold sans), short line (pack size / grade), a green "Send Enquiry" button (and optional "Price on request"). Soft lift + green border on hover.
- **Category card:** circular or rounded image + label, like a clean e-commerce category row.
- **Company/supplier card:** logo, name, location, green "Verified" pill, product tags.
- **Buttons:** primary = solid green; secondary = green outline; small pills for tags in `--green-wash` with `--green-deep` text.
- **Badges:** "Verified" = green pill with check; "Gold Member" = small gold pill; "Silver Member" = soft grey-gold pill.
- **Search bar:** large, white, soft shadow, green focus ring, scope dropdown (Products / Companies / Buy Leads).
- **Inputs:** white with `--border`, green focus ring, dark text.

## Imagery
- Bright, crisp product photography on white or soft-green backgrounds. Live plants/saplings, agarwood products, spices — natural, fresh, well-lit.
- Avoid dark, moody, or generic corporate stock. Keep it clean and natural.

## Tone of microcopy
Warm, plain-English, natural-trade flavored: "Connecting Assam to the world", "Get quotes from verified suppliers", "Post what you want to buy", "100% natural".

## Accessibility
Dark green / near-black text on white passes AA. Green buttons use white text. Keep contrast strong; don't put light green text on white.

## Do / Don't
- DO: white & soft-green backgrounds, bold friendly sans headings, solid green buttons, crisp product photos, airy spacing, gentle green-wash section bands.
- DON'T: dark/black backgrounds, cream+brass-gold flood, cluttered tiles, aggressive popups, gold everywhere. Gold is a tiny premium accent only.
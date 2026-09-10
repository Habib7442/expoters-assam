/**
 * Turns a product name into a URL safe slug: NFKD-normalizes, strips
 * diacritics, lowercases, collapses non-alphanumeric runs to a single
 * hyphen, trims, and truncates to 80 characters. Falls back to a random id
 * based slug when the name normalizes to nothing (e.g. a name in a script
 * this naive rule strips entirely), so a slug is never blank.
 *
 * This only produces a candidate; it does not guarantee uniqueness. The
 * caller retries the insert with a suffix on a unique_violation (23505).
 *
 * Deliberately its own module, no other exports and no other imports:
 * `scripts/seed-demo.ts` is a plain Node script (run via `tsx`, outside
 * Next's module resolution), so anything it imports must never transitively
 * pull in a `server-only` guarded module (that guard throws unconditionally
 * outside Next's build, see `lib/storage/r2.ts`). Keeping this pure and
 * isolated means `products.ts` (which does need `r2.ts`, for its own image
 * URL guard) can't accidentally break the seed script just by being edited.
 */
export function generateSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return base || `product-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Turns visitor-typed text into an `ilike` "contains" pattern that matches
 * it literally.
 *
 * Passing raw text as `%${text}%` lets the visitor's own `%` and `_` act as
 * LIKE wildcards, so a search for "%" or "_" matches every row instead of
 * rows that contain that character. Postgres's default LIKE escape is the
 * backslash, so `\`, `%` and `_` are escaped with one.
 *
 * `*` is the exception, verified against the live database: PostgREST
 * rewrites every `*` in a like/ilike operand to `%` *before* Postgres sees
 * it, backslash or not (`\*` still ends up a wildcard-ish `\%` and matches
 * nothing), so a literal `*` can't be expressed at all through this
 * operator. It becomes `_` (any one character), which still matches a real
 * `*` and, unlike a bare `%`, can't silently turn one keystroke into
 * "match everything".
 */
export function containsPattern(value: string): string {
  const escaped = value.replace(/[\\%_*]/g, (char) => (char === "*" ? "_" : `\\${char}`));
  return `%${escaped}%`;
}

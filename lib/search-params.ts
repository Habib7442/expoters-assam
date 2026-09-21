/**
 * What Next.js actually hands a page for one query param: a repeated one
 * (`?q=Tea&q=Oil`) arrives as `string[]`, not the plain `string` these pages
 * used to declare, so anything that assumed a string (`.toLowerCase()`,
 * `encodeURIComponent`, a Supabase filter) broke or quietly searched for a
 * joined "Tea,Oil".
 */
export type SearchParamValue = string | string[] | undefined;

/** The first value of a possibly repeated query param, or undefined if absent. */
export function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

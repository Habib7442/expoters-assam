import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown[] | null; error: { message: string } | null };
const results: Record<string, Result> = {};
/** Pages requested per table, as [from, to]; `failFrom` makes a page starting there fail. */
const ranges: Record<string, [number, number][]> = {};
let failFrom: { table: string; from: number } | null = null;

/**
 * Filters return the builder; `.range(from, to)` slices that table's rows the
 * way PostgREST pages them, so the sitemap's paging loop runs for real.
 */
function builderFor(table: string) {
  let window: [number, number] | null = null;
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) builder[method] = vi.fn(() => builder);
  builder.range = vi.fn((from: number, to: number) => {
    window = [from, to];
    (ranges[table] ??= []).push([from, to]);
    return builder;
  });
  builder.then = (onFulfilled: (v: Result) => unknown) => {
    const all = results[table];
    if (failFrom && failFrom.table === table && window?.[0] === failFrom.from) {
      return Promise.resolve(onFulfilled({ data: null, error: { message: "timeout" } }));
    }
    const data = all.data && window ? all.data.slice(window[0], window[1] + 1) : all.data;
    return Promise.resolve(onFulfilled({ data, error: all.error }));
  };
  return builder;
}
vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: (table: string) => builderFor(table) },
}));

import sitemap from "./sitemap";
import robots from "./robots";

const SITE = "https://www.exportersassam.com";

describe("sitemap", () => {
  beforeEach(() => {
    failFrom = null;
    for (const key of Object.keys(ranges)) delete ranges[key];
    results.products = { data: [{ slug: "ahi-resin-gold", updated_at: "2026-09-20T10:00:00Z" }], error: null };
    results.companies = { data: [{ slug: "avadi-herbs-india", created_at: "2026-09-12T03:14:38Z" }], error: null };
    results.categories = { data: [{ slug: "spices-herbs" }], error: null };
  });

  it("lists static pages, category pages, companies and products on the live domain", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain(`${SITE}/`);
    expect(urls).toContain(`${SITE}/faq`);
    expect(urls).toContain(`${SITE}/products?category=spices-herbs`);
    expect(urls).toContain(`${SITE}/companies/avadi-herbs-india`);
    expect(urls).toContain(`${SITE}/products/ahi-resin-gold`);
  });

  it("never lists a private page", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => /list-business|products\/new|sign-in|sign-up|\/api\//.test(url))).toBe(false);
  });

  it("dates products by their last update and companies by when they joined", async () => {
    const entries = await sitemap();

    expect(entries.find((e) => e.url.endsWith("/products/ahi-resin-gold"))?.lastModified).toEqual(new Date("2026-09-20T10:00:00Z"));
    expect(entries.find((e) => e.url.endsWith("/companies/avadi-herbs-india"))?.lastModified).toEqual(new Date("2026-09-12T03:14:38Z"));
  });

  it("still returns the rest of the sitemap when one query fails", async () => {
    results.products = { data: null, error: { message: "timeout" } };
    vi.spyOn(console, "error").mockImplementation(() => {});

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain(`${SITE}/companies/avadi-herbs-india`);
    expect(urls.some((url) => url.includes("/products/ahi"))).toBe(false);
  });
});

describe("sitemap paging past the 1000 row cap", () => {
  beforeEach(() => {
    failFrom = null;
    for (const key of Object.keys(ranges)) delete ranges[key];
    results.products = {
      data: Array.from({ length: 2500 }, (_, i) => ({ slug: `p-${i}`, updated_at: "2026-09-20T10:00:00Z" })),
      error: null,
    };
    results.companies = { data: [], error: null };
    results.categories = { data: [], error: null };
  });

  it("fetches every product in consecutive pages of 1000, none skipped or repeated", async () => {
    const urls = (await sitemap()).map((entry) => entry.url).filter((url) => url.includes("/products/p-"));

    expect(ranges.products).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(urls).toHaveLength(2500);
    expect(new Set(urls).size).toBe(2500);
  });

  it("after a full page asks for one more, and stops at the empty page that follows", async () => {
    results.products = { data: results.products.data!.slice(0, 1000), error: null };

    await sitemap();

    // Exactly 1000 rows is a full page, so one more (empty) page confirms the end.
    expect(ranges.products).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("keeps the pages already fetched when a later page fails", async () => {
    failFrom = { table: "products", from: 1000 };
    vi.spyOn(console, "error").mockImplementation(() => {});

    const urls = (await sitemap()).map((entry) => entry.url).filter((url) => url.includes("/products/p-"));

    expect(urls).toHaveLength(1000);
  });
});

describe("robots", () => {
  it("allows crawling, blocks only the API, and points at the sitemap", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(["/api/"]);
    expect(result.sitemap).toBe(`${SITE}/sitemap.xml`);
  });

  it("leaves noindex pages crawlable, so crawlers can actually read their noindex", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    for (const path of ["/sign-in", "/sign-up", "/list-business", "/products/new"]) {
      expect(rule.disallow).not.toContain(path);
    }
  });
});

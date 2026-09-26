import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { message: string } | null };
const results: Record<string, Result> = {};

/** Every filter returns the builder; awaiting it resolves to that table's result. */
function builderFor(table: string) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) builder[method] = vi.fn(() => builder);
  builder.then = (onFulfilled: (v: Result) => unknown) => Promise.resolve(onFulfilled(results[table]));
  return builder;
}
vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: (table: string) => builderFor(table) },
}));

import sitemap from "./sitemap";
import robots from "./robots";

const SITE = "https://www.exportersasssm.com";

describe("sitemap", () => {
  beforeEach(() => {
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

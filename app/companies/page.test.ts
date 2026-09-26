import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCompaniesMock = vi.fn();
const getCompanyCountriesMock = vi.fn();
vi.mock("@/lib/supabase/queries/companies", () => ({
  getCompanies: (...args: unknown[]) => getCompaniesMock(...args),
  getCompanyCountries: (...args: unknown[]) => getCompanyCountriesMock(...args),
}));
const getCategoriesMock = vi.fn();
vi.mock("@/lib/supabase/queries/home", () => ({
  getCategoriesWithProductCounts: () => getCategoriesMock(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));
vi.mock("@/components/search-bar", () => ({ SearchBar: () => createElement("div") }));

import CompaniesPage from "./page";

const categories = [
  { id: "a", name: "Agriculture Products", slug: "agriculture-products", imageUrl: null, productCount: 5 },
  { id: "t", name: "Tea", slug: "tea", imageUrl: null, productCount: 0 },
];
const company = { id: "c1", slug: "avadi", name: "Avadi Herbs India", logoUrl: null, location: "Silchar", verified: true };

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup((await CompaniesPage({ searchParams: Promise.resolve(params) })) as ReactElement);
}

describe("CompaniesPage filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompaniesMock.mockResolvedValue([company]);
    getCategoriesMock.mockResolvedValue(categories);
    getCompanyCountriesMock.mockResolvedValue(["India"]);
  });

  it("passes the search, category and country from the URL to the query", async () => {
    await render({ q: "herb", category: "tea", country: "India" });

    expect(getCompaniesMock).toHaveBeenCalledWith({ query: "herb", categorySlug: "tea", country: "India" });
  });

  it("offers only categories that have products, so no chip leads to an empty page", async () => {
    const html = await render();

    expect(html).toContain("category=agriculture-products");
    expect(html).not.toContain("category=tea");
  });

  it("still shows an empty category chip when it is the one already picked", async () => {
    getCompaniesMock.mockResolvedValue([]);

    const html = await render({ category: "tea" });

    expect(html).toMatch(/category=tea" aria-current="true"/);
  });

  it("hides the country row while only one country exists", async () => {
    expect(await render()).not.toContain('aria-label="Filter by country"');
  });

  it("shows the country row once a second country exists", async () => {
    getCompanyCountriesMock.mockResolvedValue(["Bhutan", "India"]);

    expect(await render()).toContain('aria-label="Filter by country"');
  });

  it("names every active filter when nothing matches, with a way to clear them", async () => {
    getCompaniesMock.mockResolvedValue([]);

    const html = await render({ category: "tea", country: "Bhutan", q: "oud" });

    expect(html).toContain("No companies in “Tea” from Bhutan matching “oud”.");
    expect(html).toContain("Clear filters");
  });

  it("keeps every filter in the retry link when the query fails", async () => {
    getCompaniesMock.mockResolvedValue(null);

    const html = await render({ category: "tea", country: "India" });

    expect(html).toContain('href="/companies?category=tea&amp;country=India"');
  });
});

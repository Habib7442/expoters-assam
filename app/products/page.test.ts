import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getProductsMock = vi.fn();
vi.mock("@/lib/supabase/queries/products", () => ({
  getProducts: (...args: unknown[]) => getProductsMock(...args),
}));
const getCompanyCountriesMock = vi.fn();
vi.mock("@/lib/supabase/queries/companies", () => ({
  getCompanyCountries: (...args: unknown[]) => getCompanyCountriesMock(...args),
}));
const getCategoriesMock = vi.fn();
vi.mock("@/lib/supabase/queries/home", () => ({
  getCategoriesWithProductCounts: () => getCategoriesMock(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));
vi.mock("@/components/search-bar", () => ({ SearchBar: () => createElement("div") }));

import ProductsPage from "./page";

const product = {
  id: "p1",
  slug: "delta",
  name: "Delta",
  imageUrl: "https://images.exportersasssm.com/products/d.png",
  companyName: "Avadi",
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup((await ProductsPage({ searchParams: Promise.resolve(params) })) as ReactElement);
}

describe("ProductsPage filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProductsMock.mockResolvedValue([product]);
    getCategoriesMock.mockResolvedValue([{ id: "t", name: "Tea", slug: "tea", imageUrl: null, productCount: 3 }]);
    getCompanyCountriesMock.mockResolvedValue(["Bhutan", "India"]);
  });

  it("passes category, country and search to the query", async () => {
    await render({ category: "tea", country: "India", q: "green" });

    expect(getProductsMock).toHaveBeenCalledWith({ categorySlug: "tea", country: "India", query: "green" });
  });

  it("lists countries from verified suppliers only, matching what the page shows", async () => {
    await render();

    expect(getCompanyCountriesMock).toHaveBeenCalledWith({ verifiedOnly: true });
  });

  it("names the country in the empty message even with a category and search", async () => {
    getProductsMock.mockResolvedValue([]);

    const html = await render({ category: "tea", country: "Bhutan", q: "green" });

    expect(html).toContain("No products in “Tea” from Bhutan matching “green”.");
  });

  it("keeps the country when suggesting looser matches", async () => {
    getProductsMock.mockResolvedValueOnce([]).mockResolvedValue([product]);

    const html = await render({ category: "tea", country: "India", q: "green" });

    expect(getProductsMock).toHaveBeenCalledWith({ query: "green", country: "India" });
    expect(getProductsMock).toHaveBeenCalledWith({ categorySlug: "tea", country: "India" });
    expect(html).toContain("Matching “green” in all categories from India");
  });

  it("keeps every filter in the retry link when the query fails", async () => {
    getProductsMock.mockResolvedValue(null);

    const html = await render({ category: "tea", country: "India" });

    expect(html).toContain('href="/products?category=tea&amp;country=India"');
  });
});

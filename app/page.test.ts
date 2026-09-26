import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CategoryWithCount,
  FeaturedExporter,
  FeaturedProduct,
  LatestBuyRequirement,
} from "@/lib/supabase/queries/home";

const getCategoriesMock = vi.fn();
const getFeaturedProductsMock = vi.fn();
const getFeaturedExportersMock = vi.fn();
const getLatestBuyRequirementsMock = vi.fn();
vi.mock("@/lib/supabase/queries/home", () => ({
  getCategoriesWithProductCounts: () => getCategoriesMock(),
  getFeaturedProducts: (limit: number) => getFeaturedProductsMock(limit),
  getFeaturedExporters: (limit: number) => getFeaturedExportersMock(limit),
  getLatestBuyRequirements: (limit: number) => getLatestBuyRequirementsMock(limit),
}));

// Plain elements in place of Next's own, so the tree renders outside Next.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));
// A client component that needs the router; its own behavior is not under test here.
vi.mock("@/components/hero-search", () => ({
  HeroSearch: () => createElement("div", { "data-hero-search": true }),
}));

import Home from "./page";

const R2 = "https://images.exportersasssm.com";

const categories: CategoryWithCount[] = [
  { id: "a", name: "Agarwood & Oud", slug: "agarwood-oud", imageUrl: null, productCount: 5 },
  { id: "t", name: "Tea", slug: "tea", imageUrl: null, productCount: 0 },
];
const products: FeaturedProduct[] = [
  { id: "p1", slug: "anwma-a5000", name: "ANWMA A5000", imageUrl: `${R2}/products/a.webp`, companyName: "Avadi Herbs India" },
  { id: "p2", slug: "delta-x500", name: "DELTA X500", imageUrl: `${R2}/products/d.webp`, companyName: "Avadi Herbs India" },
];
const exporters: FeaturedExporter[] = [
  { id: "c1", slug: "avadi-herbs-india", name: "Avadi Herbs India", logoUrl: null, location: "Silchar", verified: true },
];
const requirements: LatestBuyRequirement[] = [
  { id: "r1", productText: "Green cardamom", quantity: "5 MT", location: "Dubai", createdAt: "2026-09-25T10:00:00Z" },
];

const HEADINGS = {
  categories: ">Shop by Category<",
  products: ">Featured Products<",
  exporters: ">Featured Exporters<",
  requirements: ">Latest Buy Requirements<",
};

async function renderHome(): Promise<string> {
  return renderToStaticMarkup((await Home()) as ReactElement);
}

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCategoriesMock.mockResolvedValue(categories);
    getFeaturedProductsMock.mockResolvedValue(products);
    getFeaturedExportersMock.mockResolvedValue(exporters);
    getLatestBuyRequirementsMock.mockResolvedValue(requirements);
  });

  it("asks for 8 featured products, 6 exporters and 5 buy requirements", async () => {
    await renderHome();

    expect(getFeaturedProductsMock).toHaveBeenCalledWith(8);
    expect(getFeaturedExportersMock).toHaveBeenCalledWith(6);
    expect(getLatestBuyRequirementsMock).toHaveBeenCalledWith(5);
  });

  it("renders every section when every query succeeds", async () => {
    const html = await renderHome();

    for (const heading of Object.values(HEADINGS)) expect(html).toContain(heading);
  });

  it("shows the hero heading and both entry actions (AC-2)", async () => {
    const html = await renderHome();

    expect(html).toContain("India&#x27;s Gateway to Global Trade");
    expect(html).toContain('href="/buy-requirements/new"');
    expect(html).toContain('href="/list-business"');
  });

  it("no longer shows the dropped stats strip (AC-9, dropped 2026-09-26)", async () => {
    const html = await renderHome();

    expect(html).not.toContain("Verified Exporters");
    expect(html).not.toContain("Global Buyers");
  });

  describe("a failing section is omitted on its own (AC-11)", () => {
    it.each([
      ["categories", getCategoriesMock],
      ["products", getFeaturedProductsMock],
      ["exporters", getFeaturedExportersMock],
      ["requirements", getLatestBuyRequirementsMock],
    ] as const)("drops only the %s section when its query returns null", async (section, mock) => {
      mock.mockResolvedValue(null);

      const html = await renderHome();

      expect(html).not.toContain(HEADINGS[section]);
      for (const [other, heading] of Object.entries(HEADINGS)) {
        if (other !== section) expect(html).toContain(heading);
      }
    });

    it("still renders the hero and signup band when every query fails", async () => {
      getCategoriesMock.mockResolvedValue(null);
      getFeaturedProductsMock.mockResolvedValue(null);
      getFeaturedExportersMock.mockResolvedValue(null);
      getLatestBuyRequirementsMock.mockResolvedValue(null);

      const html = await renderHome();

      expect(html).toContain("India&#x27;s Gateway to Global Trade");
      expect(html).toContain("Join Exporters Assam Free");
    });

    it("shows no category chips at all, never made up ones, when categories fail to load", async () => {
      getCategoriesMock.mockResolvedValue(null);

      const html = await renderHome();

      expect(html).not.toContain('aria-label="Categories"');
      expect(html).not.toContain("Live Plants");
    });
  });

  it("links each category chip to its filtered product list", async () => {
    const html = await renderHome();

    const chips = html.slice(html.indexOf('aria-label="Categories"'), html.indexOf("</nav>"));
    expect(chips.match(/href="\/products\?category=[^"]+"/g)).toEqual([
      'href="/products?category=agarwood-oud"',
      'href="/products?category=tea"',
    ]);
  });

  it("lists every category with its count, including a zero, linking to the filtered product list (AC-5)", async () => {
    const html = await renderHome();

    expect(html).toContain('href="/products?category=agarwood-oud"');
    expect(html).toContain('href="/products?category=tea"');
    expect(html).toMatch(/Agarwood &amp; Oud<\/span><span[^>]*>5 products</);
    expect(html).toMatch(/Tea<\/span><span[^>]*>0 products</);
  });

  it("shows exactly as many product cards as there are products, each linking to its page (AC-6)", async () => {
    const html = await renderHome();

    const section = html.slice(html.indexOf(HEADINGS.products), html.indexOf(HEADINGS.exporters));
    expect(section.match(/href="\/products\/[^"]+"/g)).toEqual([
      'href="/products/anwma-a5000"',
      'href="/products/delta-x500"',
    ]);
  });

  it("links each featured exporter to its company page (AC-7)", async () => {
    const html = await renderHome();

    expect(html).toContain('href="/companies/avadi-herbs-india"');
  });

  it("leaves out the whole buy requirements section, heading included, when there are none (AC-8)", async () => {
    getLatestBuyRequirementsMock.mockResolvedValue([]);

    const html = await renderHome();

    expect(html).not.toContain("Latest Buy Requirements");
  });

  it("shows a buy requirement with an absolute posted date, never a relative one (AC-8)", async () => {
    const html = await renderHome();

    expect(html).toContain("Green cardamom");
    expect(html).toMatch(/Posted (<!-- -->)?Sep 25, 2026/);
    expect(html).not.toMatch(/\bago\b/);
  });

  it("dates a requirement by India time, so one posted just after midnight IST shows that day (AC-8)", async () => {
    getLatestBuyRequirementsMock.mockResolvedValue([
      { ...requirements[0], createdAt: "2026-09-25T19:00:00Z" },
    ]);

    const html = await renderHome();

    expect(html).toMatch(/Posted (<!-- -->)?Sep 26, 2026/);
  });
});

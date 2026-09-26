import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LatestBuyRequirement } from "@/lib/supabase/queries/home";

const getLatestBuyRequirementsMock = vi.fn();
vi.mock("@/lib/supabase/queries/home", () => ({
  getLatestBuyRequirements: (...args: unknown[]) => getLatestBuyRequirementsMock(...args),
}));

// Plain elements in place of Next's own, so the tree renders outside Next.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));
// A client component that needs the router; its own behavior is not under test here.
vi.mock("@/components/search-bar", () => ({
  SearchBar: () => createElement("div", { "data-search-bar": true }),
}));

import BuyRequirementsPage from "./page";

const requirements: LatestBuyRequirement[] = [
  { id: "r1", productText: "Green cardamom", quantity: "5 MT", location: "Dubai", createdAt: "2026-09-25T10:00:00Z" },
  { id: "r2", productText: "Assam CTC tea", quantity: "2 tonnes", location: null, createdAt: "2026-09-24T10:00:00Z" },
];

async function renderPage(q?: string): Promise<string> {
  const element = (await BuyRequirementsPage({ searchParams: Promise.resolve(q ? { q } : {}) })) as ReactElement;
  return renderToStaticMarkup(element);
}

describe("BuyRequirementsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLatestBuyRequirementsMock.mockResolvedValue(requirements);
  });

  it("asks for up to 100 public requirements, passing the search text through", async () => {
    await renderPage("cardamom");

    expect(getLatestBuyRequirementsMock).toHaveBeenCalledWith(100, "cardamom");
  });

  it("lists every requirement with a count", async () => {
    const html = await renderPage();

    expect(html).toMatch(/Recent Requirements \((<!-- -->)?2(<!-- -->)?\)/);
    expect(html).toContain("Green cardamom");
    expect(html).toContain("Assam CTC tea");
    expect(html).not.toContain("most recent");
  });

  it("says the list is cut off when it reaches the 100 post cap", async () => {
    getLatestBuyRequirementsMock.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({ ...requirements[0], id: `r${i}` })),
    );

    const html = await renderPage();

    expect(html).toMatch(/Showing the (<!-- -->)?100(<!-- -->)? most recent/);
  });

  it("promises only what the product does: no direct supplier quotes, lab reports or zero fee claims", async () => {
    const html = await renderPage();

    expect(html).not.toMatch(/lab test|certified|instantly|Zero Platform Fees|Direct WhatsApp Quot/i);
    expect(html).toContain("Our team matches each");
  });

  it("shows a load failure with a retry link, never an empty directory, when the query fails", async () => {
    getLatestBuyRequirementsMock.mockResolvedValue(null);

    const html = await renderPage("tea");

    expect(html).toContain('href="/buy-requirements?q=tea"');
    expect(html).not.toContain("Recent Requirements");
  });

  it("offers to post the searched product when a search finds nothing", async () => {
    getLatestBuyRequirementsMock.mockResolvedValue([]);

    const html = await renderPage("saffron & honey");

    expect(html).toContain("No buy requirements found for");
    expect(html).toContain('href="/buy-requirements/new?product=saffron%20%26%20honey"');
  });

  it("invites the first post when there are no requirements at all", async () => {
    getLatestBuyRequirementsMock.mockResolvedValue([]);

    const html = await renderPage();

    expect(html).not.toContain("No buy requirements found for");
    expect(html).toContain('href="/buy-requirements/new"');
  });
});

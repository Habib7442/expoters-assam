import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}));

import { FilterChips } from "./filter-chips";

const render = (active?: string) =>
  renderToStaticMarkup(
    createElement(FilterChips, {
      basePath: "/products",
      param: "country",
      label: "Country",
      options: [
        { value: "India", label: "India" },
        { value: "Bhutan", label: "Bhutan" },
      ],
      active,
      otherParams: { category: "tea", q: "green & black" },
    }),
  );

describe("FilterChips", () => {
  it("keeps the page's other filters in every chip link", () => {
    const html = render();

    expect(html).toContain('href="/products?category=tea&amp;q=green+%26+black&amp;country=India"');
    expect(html).toContain('href="/products?category=tea&amp;q=green+%26+black&amp;country=Bhutan"');
  });

  it("links All to the other filters without this one", () => {
    const html = render("India");

    expect(html).toContain('href="/products?category=tea&amp;q=green+%26+black"');
  });

  it("marks the active chip for assistive tech", () => {
    const html = render("Bhutan");

    expect(html).toMatch(/country=Bhutan" aria-current="true"/);
    expect(html).toContain('aria-label="Filter by country"');
  });

  it("links All to the bare page when there are no other filters", () => {
    const html = renderToStaticMarkup(
      createElement(FilterChips, {
        basePath: "/companies",
        param: "category",
        label: "Category",
        options: [],
        active: undefined,
        otherParams: {},
      }),
    );

    expect(html).toContain('href="/companies"');
  });
});

import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Plain elements in place of Next's own, so the card renders outside Next.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));

import { ExporterCard } from "./exporter-card";

const props: ComponentProps<typeof ExporterCard> = {
  slug: "avadi-herbs-india",
  name: "Avadi Herbs India",
  logoUrl: "https://images.exportersasssm.com/logos/avadi.png",
  location: "Silchar",
  verified: true,
};

const render = (overrides: Partial<typeof props> = {}) =>
  renderToStaticMarkup(createElement(ExporterCard, { ...props, ...overrides }));

describe("ExporterCard", () => {
  it("links the whole card to the company's profile page by slug", () => {
    const html = render();

    // React 19 may hoist an image preload <link> ahead of the card, so match
    // the anchor wrapping the card's content rather than the string start.
    expect(html).toMatch(/<a href="\/companies\/avadi-herbs-india">[\s\S]*Avadi Herbs India[\s\S]*<\/a>$/);
  });

  it("shows the company name, location and logo", () => {
    const html = render();

    expect(html).toContain("Avadi Herbs India");
    expect(html).toContain("Silchar");
    expect(html).toContain('<img src="https://images.exportersasssm.com/logos/avadi.png" alt="Avadi Herbs India"/>');
  });

  it("falls back to the first letter of the name when there is no logo", () => {
    const html = render({ logoUrl: null });

    expect(html).not.toContain("<img");
    expect(html).toMatch(/>A<\/div>/);
  });

  it("shows the Verified badge only for a verified company", () => {
    expect(render()).toContain("Verified");
    expect(render({ verified: false })).not.toContain("Verified");
  });
});

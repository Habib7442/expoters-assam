import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));

import FaqPage from "./page";
import ContactPage from "../contact/page";

describe("FaqPage", () => {
  it("publishes FAQPage structured data with exactly the questions shown on the page", () => {
    const html = renderToStaticMarkup(FaqPage() as ReactElement);

    const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1] ?? "";
    const data = JSON.parse(json) as { "@type": string; mainEntity: { name: string }[] };
    const shown = [...html.matchAll(/<summary[^>]*><span[^>]*>(.*?)<span/g)].map((m) =>
      m[1].replace(/&#x27;/g, "'"),
    );

    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity.map((q) => q.name)).toEqual(shown);
    expect(shown.length).toBeGreaterThan(10);
  });
});

describe("ContactPage", () => {
  const original = process.env.PLATFORM_WHATSAPP_NUMBER;
  afterEach(() => {
    process.env.PLATFORM_WHATSAPP_NUMBER = original;
  });

  it("links WhatsApp to the configured platform number", () => {
    process.env.PLATFORM_WHATSAPP_NUMBER = "+919577772757";

    const html = renderToStaticMarkup(ContactPage() as ReactElement);

    expect(html).toContain('href="https://wa.me/919577772757"');
    expect(html).toContain("+91 95777 72757");
    expect(html).toContain("mailto:info@exportsassam.com");
  });

  it("leaves the WhatsApp card out, never showing a broken link, when no number is configured", () => {
    delete process.env.PLATFORM_WHATSAPP_NUMBER;

    const html = renderToStaticMarkup(ContactPage() as ReactElement);

    expect(html).not.toContain("wa.me");
    expect(html).toContain("mailto:info@exportsassam.com");
  });
});

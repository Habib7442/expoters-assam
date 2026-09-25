import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompanyProfile } from "@/lib/supabase/queries/companies";

const getCompanyBySlugMock = vi.fn();
vi.mock("@/lib/supabase/queries/companies", () => ({
  getCompanyBySlug: (...args: unknown[]) => getCompanyBySlugMock(...args),
}));

const getCurrentTierMock = vi.fn();
vi.mock("@/lib/supabase/queries/company-tiers", () => ({
  getCurrentTier: (...args: unknown[]) => getCurrentTierMock(...args),
}));

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
}));

// Plain elements in place of Next's own, so the tree renders outside Next.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));

// The dialog is a client component; render a marker carrying its props.
vi.mock("@/components/send-enquiry-dialog", () => ({
  SendEnquiryDialog: ({
    target,
    triggerLabel,
  }: {
    target: { type: string; companyId: string };
    triggerLabel?: string;
  }) =>
    createElement(
      "button",
      { "data-target-type": target.type, "data-company-id": target.companyId },
      triggerLabel ?? "Send Enquiry",
    ),
}));

import CompanyPage, { generateMetadata } from "./page";

const R2 = "https://images.exportersasssm.com";

const company: CompanyProfile = {
  id: "c1",
  name: "Avadi Herbs India",
  slug: "avadi-herbs-india",
  logoUrl: `${R2}/logos/avadi.png`,
  about: "Wholesale and Supply Shop",
  location: "Silchar",
  country: "India",
  verified: true,
  createdAt: "2026-09-01T10:00:00Z",
  products: [
    { id: "p1", slug: "ahi-resin-gold", name: "AHI Resin Gold", imageUrl: `${R2}/products/resin.webp`, categoryName: "Agarwood & Oud" },
    { id: "p2", slug: "delta-x500", name: "Delta X500", imageUrl: null, categoryName: null },
  ],
};

const paramsFor = (slug: string) => ({ params: Promise.resolve({ slug }) });

async function renderPage(slug = "avadi-herbs-india"): Promise<string> {
  const element = (await CompanyPage(paramsFor(slug))) as ReactElement;
  return renderToStaticMarkup(element);
}

describe("CompanyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentTierMock.mockResolvedValue("basic");
  });

  it("renders the 404 page when no visible company has that slug", async () => {
    getCompanyBySlugMock.mockResolvedValue(null);

    await expect(CompanyPage(paramsFor("avadi-nursery"))).rejects.toBe(NOT_FOUND);
    expect(getCurrentTierMock).not.toHaveBeenCalled();
  });

  it("looks the company up by the slug in the URL and its tier by the company id", async () => {
    getCompanyBySlugMock.mockResolvedValue(company);

    await renderPage("avadi-herbs-india");

    expect(getCompanyBySlugMock).toHaveBeenCalledWith("avadi-herbs-india");
    expect(getCurrentTierMock).toHaveBeenCalledWith("c1");
  });

  it("shows the name, logo, about, location, product count and member since year", async () => {
    getCompanyBySlugMock.mockResolvedValue(company);

    const html = await renderPage();

    expect(html).toMatch(/<h1[^>]*>Avadi Herbs India<\/h1>/);
    expect(html).toContain(`src="${R2}/logos/avadi.png"`);
    expect(html).toContain("Wholesale and Supply Shop");
    expect(html).toContain("Silchar, India · 2 products · Member since 2026");
  });

  it("links every listed product to its own product page, with a placeholder for a missing image", async () => {
    getCompanyBySlugMock.mockResolvedValue(company);

    const html = await renderPage();

    expect(html).toContain('href="/products/ahi-resin-gold"');
    expect(html).toContain('href="/products/delta-x500"');
    expect(html).toContain("Agarwood &amp; Oud");
    expect(html).not.toContain('alt="Delta X500"');
  });

  it("links the breadcrumb back to home and the company directory", async () => {
    getCompanyBySlugMock.mockResolvedValue(company);

    const html = await renderPage();

    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/companies"');
  });

  it("offers one Send Enquiry aimed at this company", async () => {
    getCompanyBySlugMock.mockResolvedValue(company);

    const html = await renderPage();

    expect(html.match(/data-target-type="company"/g)).toHaveLength(1);
    expect(html).toContain('data-company-id="c1"');
    expect(html).not.toContain("Enquire About Products");
  });

  it("shows the Verified badge only for a verified company", async () => {
    getCompanyBySlugMock.mockResolvedValue(company);
    const verified = await renderPage();

    getCompanyBySlugMock.mockResolvedValue({ ...company, verified: false });
    const unverified = await renderPage();

    expect(verified).toContain("Verified");
    expect(unverified).not.toContain("Verified");
  });

  it.each(["silver", "gold"])("shows a %s member badge for a %s tier company", async (tier) => {
    getCompanyBySlugMock.mockResolvedValue(company);
    getCurrentTierMock.mockResolvedValue(tier);

    const html = await renderPage();

    expect(html).toMatch(new RegExp(`${tier}(<!-- -->)?\\s*member`));
  });

  it("shows no member badge for a basic tier company", async () => {
    getCompanyBySlugMock.mockResolvedValue(company);

    const html = await renderPage();

    expect(html).not.toMatch(/member</);
  });

  it("shows an empty state with a second enquiry button when the company has no products", async () => {
    getCompanyBySlugMock.mockResolvedValue({ ...company, products: [] });

    const html = await renderPage();

    expect(html).toContain("0 products");
    expect(html).toContain("hasn&#x27;t listed any products yet");
    expect(html).toContain("Enquire About Products");
    expect(html.match(/data-target-type="company"/g)).toHaveLength(2);
  });

  it("says 1 product, not 1 products", async () => {
    getCompanyBySlugMock.mockResolvedValue({ ...company, products: [company.products[0]] });

    const html = await renderPage();

    expect(html).toContain("· 1 product ·");
  });

  it("falls back to the first letter of the name when there is no logo", async () => {
    getCompanyBySlugMock.mockResolvedValue({ ...company, logoUrl: null });

    const html = await renderPage();

    expect(html).not.toContain('alt="Avadi Herbs India"');
    expect(html).toMatch(/>A<\/div>/);
  });

  it("leaves out the About section, location and member year when they are missing", async () => {
    getCompanyBySlugMock.mockResolvedValue({ ...company, about: null, location: null, createdAt: undefined });

    const html = await renderPage();

    expect(html).not.toContain(">About<");
    expect(html).toContain("India · 2 products<");
    expect(html).not.toContain("Member since");
  });

  it("uses the UTC year for member since, so a New Year's Eve signup is not shifted", async () => {
    getCompanyBySlugMock.mockResolvedValue({ ...company, createdAt: "2025-12-31T23:30:00Z" });

    const html = await renderPage();

    expect(html).toContain("Member since 2025");
  });

  it("escapes a company name instead of rendering it as markup", async () => {
    getCompanyBySlugMock.mockResolvedValue({ ...company, name: "<script>alert(1)</script>" });

    const html = await renderPage();

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("titles the page with the company name", async () => {
    getCompanyBySlugMock.mockResolvedValue(company);

    const metadata = await generateMetadata(paramsFor("avadi-herbs-india"));

    expect(metadata.title).toBe("Avadi Herbs India | Exporters Assam");
    expect(metadata.description).toBe("Wholesale and Supply Shop");
  });

  it("trims a long about text to 155 characters", async () => {
    getCompanyBySlugMock.mockResolvedValue({ ...company, about: "x".repeat(400) });

    const metadata = await generateMetadata(paramsFor("avadi-herbs-india"));

    expect(metadata.description).toHaveLength(155);
  });

  it("writes a fallback description naming the company when there is no about text", async () => {
    getCompanyBySlugMock.mockResolvedValue({ ...company, about: null });

    const metadata = await generateMetadata(paramsFor("avadi-herbs-india"));

    expect(metadata.description).toContain("Avadi Herbs India on Exporters Assam");
  });

  it("returns empty metadata for a missing company instead of throwing", async () => {
    getCompanyBySlugMock.mockResolvedValue(null);

    await expect(generateMetadata(paramsFor("avadi-nursery"))).resolves.toEqual({});
  });
});

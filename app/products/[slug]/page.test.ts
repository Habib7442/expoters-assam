import { beforeEach, describe, expect, it, vi } from "vitest";

const getProductBySlugMock = vi.fn();
vi.mock("@/lib/supabase/queries/products", () => ({
  getProductBySlug: (...args: unknown[]) => getProductBySlugMock(...args),
}));

const getCurrentTierMock = vi.fn();
vi.mock("@/lib/supabase/queries/company-tiers", () => ({
  getCurrentTier: (...args: unknown[]) => getCurrentTierMock(...args),
}));

vi.mock("@/lib/storage/r2", () => ({ isR2Url: () => true }));

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
}));

// Client components are rendered by React, not by this test; stub them out.
vi.mock("@/components/product-gallery", () => ({ ProductGallery: () => null }));
vi.mock("@/components/send-enquiry-dialog", () => ({ SendEnquiryDialog: () => null }));

import ProductPage, { generateMetadata } from "./page";

const product = {
  id: "p1",
  slug: "ahi-resin-gold",
  name: "AHI Resin Gold",
  description: "Grade A agarwood resin from upper Assam.",
  image_url: "https://images.exportersasssm.com/products/main.webp",
  gallery_urls: [],
  category: { name: "Agarwood & Oud" },
  company: {
    id: "c1",
    slug: "avadi-herbs",
    name: "Avadi Herbs India Pvt Ltd",
    logo_url: null,
    location: "Guwahati, Assam",
    verified: true,
  },
};

const paramsFor = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("ProductPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentTierMock.mockResolvedValue("basic");
  });

  // covers: AC-1 (missing product, or one under a pending company, both reach here as null)
  it("AC-1: renders the 404 page when no approved product has that slug", async () => {
    getProductBySlugMock.mockResolvedValue(null);

    await expect(ProductPage(paramsFor("does-not-exist"))).rejects.toBe(NOT_FOUND);
    expect(getCurrentTierMock).not.toHaveBeenCalled();
  });

  // covers: AC-1
  it("AC-1: looks up the product by the slug in the URL and renders it", async () => {
    getProductBySlugMock.mockResolvedValue(product);

    const page = await ProductPage(paramsFor("ahi-resin-gold"));

    expect(getProductBySlugMock).toHaveBeenCalledWith("ahi-resin-gold");
    expect(getCurrentTierMock).toHaveBeenCalledWith("c1");
    expect(page).toBeTruthy();
  });
});

describe("generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("titles the page with the product and company name", async () => {
    getProductBySlugMock.mockResolvedValue(product);

    const metadata = await generateMetadata(paramsFor("ahi-resin-gold"));

    expect(metadata.title).toBe("AHI Resin Gold — Avadi Herbs India Pvt Ltd | Exporters Assam");
    expect(metadata.description).toBe(product.description);
  });

  it("trims a long description to 155 characters", async () => {
    getProductBySlugMock.mockResolvedValue({ ...product, description: "x".repeat(400) });

    const metadata = await generateMetadata(paramsFor("ahi-resin-gold"));

    expect(metadata.description).toHaveLength(155);
  });

  it("writes a fallback description naming the product and company when there is none", async () => {
    getProductBySlugMock.mockResolvedValue({ ...product, description: null });

    const metadata = await generateMetadata(paramsFor("ahi-resin-gold"));

    expect(metadata.description).toContain("AHI Resin Gold from Avadi Herbs India Pvt Ltd");
  });

  it("returns empty metadata for a missing product instead of throwing", async () => {
    getProductBySlugMock.mockResolvedValue(null);

    await expect(generateMetadata(paramsFor("does-not-exist"))).resolves.toEqual({});
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

const R2 = "https://images.exportersasssm.com";
vi.mock("@/lib/storage/r2", () => ({
  isR2Url: (url: string) => url.startsWith("https://images.exportersasssm.com/"),
}));

import { getProductBySlug, getProducts } from "./products";

type Result = { data: unknown; error: { message: string } | null };

/**
 * A chainable query builder stub: every filter returns the builder, the
 * chain is awaitable directly (getProducts) and `.maybeSingle()` resolves to
 * the same result (getProductBySlug), matching supabase-js's builders.
 */
function builderResolvingTo(result: Result) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "ilike", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (onFulfilled: (v: Result) => unknown) => Promise.resolve(onFulfilled(result));
  return builder as Record<string, ReturnType<typeof vi.fn>>;
}

const productRow = {
  id: "p1",
  slug: "ahi-resin-gold",
  name: "AHI Resin Gold",
  description: "Grade A resin",
  image_url: `${R2}/products/main.webp`,
  gallery_urls: [`${R2}/products/second.webp`],
  categories: { name: "Agarwood & Oud" },
  companies: {
    id: "c1",
    slug: "avadi-herbs",
    name: "Avadi Herbs India Pvt Ltd",
    logo_url: `${R2}/logos/avadi.webp`,
    location: "Guwahati, Assam",
    verified: true,
  },
};

describe("getProductBySlug", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  // covers: AC-1
  it("AC-1: returns the product with its category and company card fields", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: productRow, error: null }));

    const product = await getProductBySlug("ahi-resin-gold");

    expect(product).toEqual({
      id: "p1",
      slug: "ahi-resin-gold",
      name: "AHI Resin Gold",
      description: "Grade A resin",
      image_url: `${R2}/products/main.webp`,
      gallery_urls: [`${R2}/products/second.webp`],
      category: { name: "Agarwood & Oud" },
      company: productRow.companies,
    });
  });

  // covers: AC-1 (a pending product, or one under a pending company, comes back as no row through RLS and the inner join)
  it("AC-1: asks only for an approved product with that slug, through an inner company join", async () => {
    const builder = builderResolvingTo({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await getProductBySlug("ahi-resin-gold");

    expect(fromMock).toHaveBeenCalledWith("products");
    expect(builder.eq).toHaveBeenCalledWith("slug", "ahi-resin-gold");
    expect(builder.eq).toHaveBeenCalledWith("status", "approved");
    expect(builder.select.mock.calls[0][0]).toContain("companies!inner");
  });

  // covers: AC-1
  it("AC-1: returns null when no approved product matches, so the page can 404", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error: null }));

    await expect(getProductBySlug("does-not-exist")).resolves.toBeNull();
  });

  it("throws a database error rather than reporting it as a missing product", async () => {
    const error = { message: "connection refused" };
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error }));

    await expect(getProductBySlug("ahi-resin-gold")).rejects.toBe(error);
  });

  it("drops gallery images and a logo that are not on the R2 image domain", async () => {
    fromMock.mockReturnValue(
      builderResolvingTo({
        data: {
          ...productRow,
          gallery_urls: ["https://evil.example/x.png", `${R2}/products/second.webp`],
          companies: { ...productRow.companies, logo_url: "https://evil.example/logo.png" },
        },
        error: null,
      }),
    );

    const product = await getProductBySlug("ahi-resin-gold");

    expect(product?.gallery_urls).toEqual([`${R2}/products/second.webp`]);
    expect(product?.company.logo_url).toBeNull();
  });

  it("falls back to the first trusted gallery image when the main image is not on R2", async () => {
    fromMock.mockReturnValue(
      builderResolvingTo({ data: { ...productRow, image_url: "https://old-bucket.example/main.png" }, error: null }),
    );

    const product = await getProductBySlug("ahi-resin-gold");

    expect(product?.image_url).toBe(`${R2}/products/second.webp`);
  });

  it("keeps a null logo and a null category as null", async () => {
    fromMock.mockReturnValue(
      builderResolvingTo({
        data: { ...productRow, categories: null, companies: { ...productRow.companies, logo_url: null } },
        error: null,
      }),
    );

    const product = await getProductBySlug("ahi-resin-gold");

    expect(product?.category).toBeNull();
    expect(product?.company.logo_url).toBeNull();
  });
});

describe("getProducts", () => {
  beforeEach(() => {
    fromMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("lists approved products from approved, verified companies, skipping images not on R2", async () => {
    const builder = builderResolvingTo({
      data: [
        { id: "p1", slug: "a", name: "A", image_url: `${R2}/products/a.webp`, companies: { name: "Co A" } },
        { id: "p2", slug: "b", name: "B", image_url: "https://evil.example/b.png", companies: { name: "Co B" } },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const products = await getProducts();

    expect(builder.eq).toHaveBeenCalledWith("status", "approved");
    expect(builder.eq).toHaveBeenCalledWith("companies.status", "approved");
    expect(builder.eq).toHaveBeenCalledWith("companies.verified", true);
    expect(products).toEqual([
      { id: "p1", slug: "a", name: "A", imageUrl: `${R2}/products/a.webp`, companyName: "Co A" },
    ]);
  });

  it("returns null, not an empty list, when the query fails", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error: { message: "boom" } }));

    await expect(getProducts()).resolves.toBeNull();
  });
});

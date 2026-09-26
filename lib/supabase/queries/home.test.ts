import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

const R2 = "https://images.exportersasssm.com";
vi.mock("@/lib/storage/r2", () => ({
  R2_PUBLIC_DOMAIN: "images.exportersasssm.com",
  isR2Url: (url: string) => url.startsWith("https://images.exportersasssm.com/"),
}));

import {
  getCategoriesWithProductCounts,
  getFeaturedExporters,
  getFeaturedProducts,
  getLatestBuyRequirements,
} from "./home";

type Result = { data: unknown; error: { message: string } | null };

/** A chainable, awaitable query builder stub, matching supabase-js's builders. */
function builderResolvingTo(result: Result) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "ilike", "like", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (onFulfilled: (v: Result) => unknown) => Promise.resolve(onFulfilled(result));
  return builder as Record<string, ReturnType<typeof vi.fn>>;
}

const dbError = { message: "column does not exist" };

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
});

describe("getCategoriesWithProductCounts", () => {
  function mockTables(categories: Result, counts: Result) {
    const categoriesBuilder = builderResolvingTo(categories);
    const countsBuilder = builderResolvingTo(counts);
    fromMock.mockImplementation((table: string) =>
      table === "categories" ? categoriesBuilder : countsBuilder,
    );
    return { categoriesBuilder, countsBuilder };
  }

  it("orders categories by name and reads counts from the aggregate view, not product rows (AC-5)", async () => {
    const { categoriesBuilder } = mockTables({ data: [], error: null }, { data: [], error: null });

    await getCategoriesWithProductCounts();

    expect(fromMock).toHaveBeenCalledWith("categories");
    expect(fromMock).toHaveBeenCalledWith("category_product_counts");
    expect(fromMock).not.toHaveBeenCalledWith("products");
    expect(categoriesBuilder.order).toHaveBeenCalledWith("name", { ascending: true });
  });

  it("pairs each category with its count and shows zero for a category with no products (AC-5)", async () => {
    mockTables(
      {
        data: [
          { id: "a", name: "Agarwood & Oud", slug: "agarwood-oud", image_url: null },
          { id: "t", name: "Tea", slug: "tea", image_url: null },
        ],
        error: null,
      },
      { data: [{ category_id: "a", product_count: 5 }], error: null },
    );

    const result = await getCategoriesWithProductCounts();

    expect(result?.map((c) => [c.name, c.productCount])).toEqual([
      ["Agarwood & Oud", 5],
      ["Tea", 0],
    ]);
  });

  it("keeps an R2 category image and drops one hosted anywhere else", async () => {
    mockTables(
      {
        data: [
          { id: "a", name: "A", slug: "a", image_url: `${R2}/categories/a.webp` },
          { id: "b", name: "B", slug: "b", image_url: "https://evil.example.com/b.webp" },
        ],
        error: null,
      },
      { data: [], error: null },
    );

    const result = await getCategoriesWithProductCounts();

    expect(result?.map((c) => c.imageUrl)).toEqual([`${R2}/categories/a.webp`, null]);
  });

  it.each([
    ["the categories query", { data: null, error: dbError }, { data: [], error: null }],
    ["the counts query", { data: [], error: null }, { data: null, error: dbError }],
  ])("returns null and logs when %s fails, instead of throwing (AC-11)", async (_label, categories, counts) => {
    mockTables(categories, counts);

    await expect(getCategoriesWithProductCounts()).resolves.toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("getFeaturedProducts", () => {
  const row = (slug: string, image_url = `${R2}/products/${slug}.webp`) => ({
    id: slug,
    slug,
    name: slug.toUpperCase(),
    image_url,
    companies: { name: "Avadi Herbs India", status: "approved", verified: true },
  });

  it("asks only for approved products of approved, verified companies, newest first with an id tie break (AC-6)", async () => {
    const builder = builderResolvingTo({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await getFeaturedProducts(8);

    expect(fromMock).toHaveBeenCalledWith("products");
    expect(builder.eq).toHaveBeenCalledWith("status", "approved");
    expect(builder.eq).toHaveBeenCalledWith("companies.status", "approved");
    expect(builder.eq).toHaveBeenCalledWith("companies.verified", true);
    expect(builder.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(builder.limit).toHaveBeenCalledWith(8);
  });

  it("filters to the R2 image host inside the query, so the limit counts only showable products (AC-6)", async () => {
    const builder = builderResolvingTo({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await getFeaturedProducts(8);

    expect(builder.like).toHaveBeenCalledWith("image_url", `${R2}/products/%`);
  });

  it("maps rows to cards with the company name, keeping the query order (AC-6)", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: [row("b"), row("a")], error: null }));

    const result = await getFeaturedProducts(8);

    expect(result).toEqual([
      { id: "b", slug: "b", name: "B", imageUrl: `${R2}/products/b.webp`, companyName: "Avadi Herbs India" },
      { id: "a", slug: "a", name: "A", imageUrl: `${R2}/products/a.webp`, companyName: "Avadi Herbs India" },
    ]);
  });

  it("still drops a non R2 image that slips past the query filter, never handing it to next/image", async () => {
    fromMock.mockReturnValue(
      builderResolvingTo({ data: [row("a"), row("b", "https://old.supabase.co/b.webp")], error: null }),
    );

    const result = await getFeaturedProducts(8);

    expect(result?.map((p) => p.slug)).toEqual(["a"]);
  });

  it("returns an empty list, not padding, when there are no products (AC-6)", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: [], error: null }));

    await expect(getFeaturedProducts(8)).resolves.toEqual([]);
  });

  it("returns null and logs on a database error (AC-11)", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error: dbError }));

    await expect(getFeaturedProducts(8)).resolves.toBeNull();
    expect(consoleError).toHaveBeenCalledWith("getFeaturedProducts failed", dbError);
  });
});

describe("getFeaturedExporters", () => {
  const company = {
    id: "c1",
    slug: "avadi-herbs-india",
    name: "Avadi Herbs India",
    logo_url: `${R2}/logos/avadi.png`,
    location: "Silchar",
    country: "India",
    verified: true,
  };

  it("asks only for approved companies, newest first with an id tie break (AC-7)", async () => {
    const builder = builderResolvingTo({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await getFeaturedExporters(6);

    expect(fromMock).toHaveBeenCalledWith("companies");
    expect(builder.eq).toHaveBeenCalledWith("status", "approved");
    expect(builder.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(builder.limit).toHaveBeenCalledWith(6);
  });

  it("maps a company to a card with its slug, logo, location and verified flag (AC-7)", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: [company], error: null }));

    const [exporter] = (await getFeaturedExporters(6)) ?? [];

    expect(exporter).toEqual({
      id: "c1",
      slug: "avadi-herbs-india",
      name: "Avadi Herbs India",
      logoUrl: `${R2}/logos/avadi.png`,
      location: "Silchar",
      verified: true,
    });
  });

  it("falls back to the country when location is missing (AC-7)", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: [{ ...company, location: null }], error: null }));

    const [exporter] = (await getFeaturedExporters(6)) ?? [];

    expect(exporter.location).toBe("India");
  });

  it.each([null, "https://old.supabase.co/logo.png"])(
    "gives no logo for %s, so the card shows the initials avatar (AC-10)",
    async (logo_url) => {
      fromMock.mockReturnValue(builderResolvingTo({ data: [{ ...company, logo_url }], error: null }));

      const [exporter] = (await getFeaturedExporters(6)) ?? [];

      expect(exporter.logoUrl).toBeNull();
    },
  );

  it("returns null and logs on a database error (AC-11)", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error: dbError }));

    await expect(getFeaturedExporters(6)).resolves.toBeNull();
    expect(consoleError).toHaveBeenCalledWith("getFeaturedExporters failed", dbError);
  });
});

describe("getLatestBuyRequirements", () => {
  it("selects only the public safe columns of public rows, never contact details or the buyer (AC-8)", async () => {
    const builder = builderResolvingTo({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await getLatestBuyRequirements(5);

    const [columns] = builder.select.mock.calls[0] as [string];
    expect(columns).toBe("id, product_text, quantity, location, created_at");
    expect(columns).not.toMatch(/contact_name|contact_email|buyer_id/);
    expect(builder.eq).toHaveBeenCalledWith("is_public", true);
  });

  it("orders newest first with an id tie break and caps at the limit (AC-8)", async () => {
    const builder = builderResolvingTo({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await getLatestBuyRequirements(5);

    expect(builder.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(builder.limit).toHaveBeenCalledWith(5);
  });

  it("maps rows to camelCase cards", async () => {
    fromMock.mockReturnValue(
      builderResolvingTo({
        data: [{ id: "r1", product_text: "Cardamom", quantity: "5 MT", location: null, created_at: "2026-09-25T10:00:00Z" }],
        error: null,
      }),
    );

    await expect(getLatestBuyRequirements(5)).resolves.toEqual([
      { id: "r1", productText: "Cardamom", quantity: "5 MT", location: null, createdAt: "2026-09-25T10:00:00Z" },
    ]);
  });

  it("filters by product text with an escaped contains pattern when a query is given", async () => {
    const builder = builderResolvingTo({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await getLatestBuyRequirements(5, "50%");

    expect(builder.ilike).toHaveBeenCalledWith("product_text", "%50\\%%");
  });

  it("applies no text filter without a query", async () => {
    const builder = builderResolvingTo({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await getLatestBuyRequirements(5);

    expect(builder.ilike).not.toHaveBeenCalled();
  });

  it("returns null and logs on a database error (AC-11)", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error: dbError }));

    await expect(getLatestBuyRequirements(5)).resolves.toBeNull();
    expect(consoleError).toHaveBeenCalledWith("getLatestBuyRequirements failed", dbError);
  });
});

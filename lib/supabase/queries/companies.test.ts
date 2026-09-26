import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

const searchIdsMock = vi.fn();
vi.mock("@/lib/supabase/queries/search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./search")>()),
  searchIds: (...args: unknown[]) => searchIdsMock(...args),
}));

const adminFromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => adminFromMock(...args) },
}));

const R2 = "https://images.exportersasssm.com";
vi.mock("@/lib/storage/r2", () => ({
  isR2Url: (url: string) => url.startsWith("https://images.exportersasssm.com/"),
}));

import { getCompanies, getCompanyBySlug, getCompanyCountries, getMyCompany } from "./companies";

type Result = { data: unknown; error: { message: string } | null };

/**
 * A chainable query builder stub: every filter returns the builder, the
 * chain is awaitable directly (getCompanies) and `.maybeSingle()` resolves
 * to the same result (getCompanyBySlug, getMyCompany), matching
 * supabase-js's builders.
 */
function builderResolvingTo(result: Result) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (onFulfilled: (v: Result) => unknown) => Promise.resolve(onFulfilled(result));
  return builder as Record<string, ReturnType<typeof vi.fn>>;
}

const companyRow = {
  id: "c1",
  name: "Avadi Herbs India",
  slug: "avadi-herbs-india",
  logo_url: `${R2}/logos/avadi.png`,
  about: "Wholesale and Supply Shop",
  location: "Silchar",
  country: "India",
  verified: true,
  created_at: "2026-09-01T10:00:00Z",
  products: [
    {
      id: "p1",
      slug: "ahi-resin-gold",
      name: "AHI Resin Gold",
      image_url: `${R2}/products/resin.webp`,
      categories: { name: "Agarwood & Oud" },
    },
  ],
};

describe("getCompanyBySlug", () => {
  beforeEach(() => {
    fromMock.mockReset();
    adminFromMock.mockReset();
  });

  it("returns the company profile with its products mapped to card fields", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: companyRow, error: null }));

    const company = await getCompanyBySlug("avadi-herbs-india");

    expect(company).toEqual({
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
        {
          id: "p1",
          slug: "ahi-resin-gold",
          name: "AHI Resin Gold",
          imageUrl: `${R2}/products/resin.webp`,
          categoryName: "Agarwood & Oud",
        },
      ],
    });
  });

  it("looks the company up by slug through the public client, never the service role client", async () => {
    const builder = builderResolvingTo({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await getCompanyBySlug("avadi-herbs-india");

    // The public client is what lets RLS hide pending/rejected companies and
    // pending products; the service role client would bypass that.
    expect(fromMock).toHaveBeenCalledWith("companies");
    expect(builder.eq).toHaveBeenCalledWith("slug", "avadi-herbs-india");
    expect(adminFromMock).not.toHaveBeenCalled();
  });

  it("also filters to approved companies and approved products in the query, on top of RLS", async () => {
    const builder = builderResolvingTo({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await getCompanyBySlug("avadi-herbs-india");

    expect(builder.eq).toHaveBeenCalledWith("status", "approved");
    expect(builder.eq).toHaveBeenCalledWith("products.status", "approved");
  });

  it("orders the company's products newest first, with id as a tiebreaker", async () => {
    const builder = builderResolvingTo({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await getCompanyBySlug("avadi-herbs-india");

    expect(builder.order).toHaveBeenNthCalledWith(1, "created_at", { referencedTable: "products", ascending: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { referencedTable: "products", ascending: true });
  });

  it("returns null when no visible company has that slug, so the page can 404", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error: null }));

    await expect(getCompanyBySlug("does-not-exist")).resolves.toBeNull();
  });

  it("throws a database error rather than reporting it as a missing company", async () => {
    const error = { message: "connection refused" };
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error }));

    await expect(getCompanyBySlug("avadi-herbs-india")).rejects.toBe(error);
  });

  it("drops a logo that is not on the R2 image domain", async () => {
    fromMock.mockReturnValue(
      builderResolvingTo({ data: { ...companyRow, logo_url: "https://evil.example/logo.png" }, error: null }),
    );

    const company = await getCompanyBySlug("avadi-herbs-india");

    expect(company?.logoUrl).toBeNull();
  });

  it("keeps a product whose image is not on R2, with its image set to null", async () => {
    fromMock.mockReturnValue(
      builderResolvingTo({
        data: {
          ...companyRow,
          products: [{ ...companyRow.products[0], image_url: "https://old-bucket.example/resin.png" }],
        },
        error: null,
      }),
    );

    const company = await getCompanyBySlug("avadi-herbs-india");

    expect(company?.products).toHaveLength(1);
    expect(company?.products[0].imageUrl).toBeNull();
  });

  it("maps a product with no category to a null category name", async () => {
    fromMock.mockReturnValue(
      builderResolvingTo({
        data: { ...companyRow, products: [{ ...companyRow.products[0], categories: null }] },
        error: null,
      }),
    );

    const company = await getCompanyBySlug("avadi-herbs-india");

    expect(company?.products[0].categoryName).toBeNull();
  });

  it("returns an empty product list for a company with no approved products", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: { ...companyRow, products: [] }, error: null }));

    const company = await getCompanyBySlug("avadi-herbs-india");

    expect(company?.products).toEqual([]);
  });

  it("keeps a null logo and null about as null", async () => {
    fromMock.mockReturnValue(
      builderResolvingTo({ data: { ...companyRow, logo_url: null, about: null }, error: null }),
    );

    const company = await getCompanyBySlug("avadi-herbs-india");

    expect(company?.logoUrl).toBeNull();
    expect(company?.about).toBeNull();
  });
});

describe("getCompanies", () => {
  beforeEach(() => {
    fromMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("lists approved companies with slugs, falling back to country when location is empty", async () => {
    const builder = builderResolvingTo({
      data: [
        { id: "c1", slug: "avadi-herbs-india", name: "Avadi Herbs India", logo_url: `${R2}/logos/a.png`, location: "Silchar", country: "India", verified: true },
        { id: "c2", slug: "locallify", name: "Locallify", logo_url: null, location: null, country: "India", verified: false },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const companies = await getCompanies();

    expect(builder.eq).toHaveBeenCalledWith("status", "approved");
    expect(searchIdsMock).not.toHaveBeenCalled();
    expect(companies).toEqual([
      { id: "c1", slug: "avadi-herbs-india", name: "Avadi Herbs India", logoUrl: `${R2}/logos/a.png`, location: "Silchar", verified: true },
      { id: "c2", slug: "locallify", name: "Locallify", logoUrl: null, location: "India", verified: false },
    ]);
  });

  it("filters to the typo tolerant search matches, keeping their ranking order", async () => {
    searchIdsMock.mockResolvedValue(["c2", "c1"]);
    const builder = builderResolvingTo({
      data: [
        { id: "c1", slug: "a", name: "A", logo_url: null, location: "X", country: "India", verified: true },
        { id: "c2", slug: "b", name: "B", logo_url: null, location: "Y", country: "India", verified: true },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const companies = await getCompanies({ query: "avdi herbs" });

    expect(searchIdsMock).toHaveBeenCalledWith("companies", "avdi herbs");
    expect(builder.in).toHaveBeenCalledWith("id", ["c2", "c1"]);
    expect(companies?.map((company) => company.id)).toEqual(["c2", "c1"]);
  });

  it("drops a logo that is not on the R2 image domain", async () => {
    fromMock.mockReturnValue(
      builderResolvingTo({
        data: [{ id: "c1", slug: "a", name: "A", logo_url: "https://evil.example/a.png", location: "X", country: "India", verified: true }],
        error: null,
      }),
    );

    const companies = await getCompanies();

    expect(companies?.[0].logoUrl).toBeNull();
  });

  it("passes the limit through, defaulting to 60", async () => {
    const builder = builderResolvingTo({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await getCompanies();
    await getCompanies({ limit: 8 });

    expect(builder.limit).toHaveBeenNthCalledWith(1, 60);
    expect(builder.limit).toHaveBeenNthCalledWith(2, 8);
  });

  it("returns null, not an empty list, when the query fails", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error: { message: "boom" } }));

    await expect(getCompanies()).resolves.toBeNull();
  });
});

describe("getMyCompany", () => {
  beforeEach(() => {
    fromMock.mockReset();
    adminFromMock.mockReset();
  });

  it("returns the caller's own company, whatever its status, with its WhatsApp number", async () => {
    const builder = builderResolvingTo({
      data: {
        id: "c3",
        name: "Avadi Nursery",
        address_line: null,
        location: "Lanka",
        state: "Assam",
        postal_code: null,
        country: "India",
        logo_url: null,
        about: null,
        email: "nursery@example.com",
        gst_number: null,
        status: "pending",
        rejection_reason: null,
        company_contacts: { whatsapp_number: "+919999999999" },
      },
      error: null,
    });
    adminFromMock.mockReturnValue(builder);

    const company = await getMyCompany("user_123");

    expect(builder.eq).toHaveBeenCalledWith("clerk_user_id", "user_123");
    expect(company?.status).toBe("pending");
    expect(company?.whatsappNumber).toBe("+919999999999");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns null when the caller has no company yet", async () => {
    adminFromMock.mockReturnValue(builderResolvingTo({ data: null, error: null }));

    await expect(getMyCompany("user_123")).resolves.toBeNull();
  });

  it("throws a database error", async () => {
    const error = { message: "boom" };
    adminFromMock.mockReturnValue(builderResolvingTo({ data: null, error }));

    await expect(getMyCompany("user_123")).rejects.toBe(error);
  });
});

describe("getCompanies filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters by country on the company itself", async () => {
    const builder = builderResolvingTo({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await getCompanies({ country: "India" });

    expect(builder.eq).toHaveBeenCalledWith("status", "approved");
    expect(builder.eq).toHaveBeenCalledWith("country", "India");
  });

  it("filters by category through an inner join on approved products only", async () => {
    const builder = builderResolvingTo({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await getCompanies({ categorySlug: "tea" });

    const [columns] = builder.select.mock.calls[0] as [string];
    expect(columns).toContain("products!inner(status, categories!inner(slug))");
    expect(builder.eq).toHaveBeenCalledWith("products.status", "approved");
    expect(builder.eq).toHaveBeenCalledWith("products.categories.slug", "tea");
  });

  it("does not join products at all without a category filter", async () => {
    const builder = builderResolvingTo({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await getCompanies({ country: "India" });

    const [columns] = builder.select.mock.calls[0] as [string];
    expect(columns).not.toContain("products");
  });
});

describe("getCompanyCountries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns each approved company's country once, alphabetically", async () => {
    const builder = builderResolvingTo({
      data: [{ country: "India" }, { country: "Bhutan" }, { country: "India" }],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    await expect(getCompanyCountries()).resolves.toEqual(["Bhutan", "India"]);
    expect(builder.eq).toHaveBeenCalledWith("status", "approved");
  });

  it("returns null on a database error, so the filter row is simply left out", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error: { message: "boom" } }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getCompanyCountries()).resolves.toBeNull();
  });
});

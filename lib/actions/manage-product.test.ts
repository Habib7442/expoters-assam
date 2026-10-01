import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

// The owned product lookup is `.select().eq(id).eq(clerk_user_id).maybeSingle()`;
// the delete is `.delete().eq(id)`. Both filters are recorded so the tests can
// pin that ownership is part of the query.
const rpcMock = vi.fn();
const ownedLookupMock = vi.fn();
const lookupFilters: [string, unknown][] = [];
const deleteMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => {
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          lookupFilters.push([column, value]);
          return query;
        },
        maybeSingle: () => ownedLookupMock(),
        delete: () => ({ eq: (column: string, value: unknown) => deleteMock(column, value) }),
      };
      return query;
    },
  },
}));

const R2 = "https://images.exportersasssm.com";
const uploadToR2Mock = vi.fn();
const deleteFromR2Mock = vi.fn();
vi.mock("@/lib/storage/r2", () => ({
  uploadToR2: (...args: unknown[]) => uploadToR2Mock(...args),
  deleteFromR2: (...args: unknown[]) => deleteFromR2Mock(...args),
  parseR2Url: (url: string) =>
    url.startsWith(`${R2}/products/`) ? { category: "products", key: url.slice(`${R2}/products/`.length) } : null,
}));

import { deleteProduct, updateProduct, type UpdateProductInput } from "./manage-product";

let PNG_BYTES: Uint8Array<ArrayBuffer>;
beforeAll(async () => {
  PNG_BYTES = new Uint8Array(
    await sharp({ create: { width: 4, height: 4, channels: 3, background: "#2e7d32" } }).png().toBuffer(),
  );
});
const png = (name = "a.png") => new File([PNG_BYTES], name, { type: "image/png" });

const PRODUCT_ID = "3f2b6c1e-8a4d-4f7e-9b1a-2c5d8e0f1a2b";
const CATEGORY = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const OLD_A = `${R2}/products/user_123/a.webp`;
const OLD_B = `${R2}/products/user_123/b.webp`;

function ownedProduct(overrides: { status?: string; companyStatus?: string } = {}) {
  return {
    data: {
      id: PRODUCT_ID,
      slug: "agarwood-chips",
      status: overrides.status ?? "approved",
      image_url: OLD_A,
      gallery_urls: [OLD_A, OLD_B],
      companies: { slug: "avadi-herbs", status: overrides.companyStatus ?? "approved", clerk_user_id: "user_123" },
    },
    error: null,
  };
}

const input = (overrides: Partial<UpdateProductInput> = {}): UpdateProductInput => ({
  productId: PRODUCT_ID,
  name: "Agarwood chips, Grade A",
  description: "Updated",
  categoryId: CATEGORY,
  keepImageUrls: [OLD_A, OLD_B],
  newImages: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  lookupFilters.length = 0;
  authMock.mockResolvedValue({ userId: "user_123" });
  ownedLookupMock.mockResolvedValue(ownedProduct());
  uploadToR2Mock.mockImplementation(async (_category: string, key: string) => `${R2}/products/${key}`);
  deleteFromR2Mock.mockResolvedValue(undefined);
  rpcMock.mockResolvedValue({ data: [{ product_id: PRODUCT_ID, status: "pending", slug: "agarwood-chips" }], error: null });
  deleteMock.mockResolvedValue({ error: null });
});

describe("updateProduct", () => {
  it("refuses a signed out caller before reading anything", async () => {
    authMock.mockResolvedValue({ userId: null });

    await expect(updateProduct(input())).resolves.toMatchObject({ ok: false, code: "not_signed_in" });
    expect(ownedLookupMock).not.toHaveBeenCalled();
  });

  it("AC-4: looks the product up through the caller's own company, and treats another supplier's product as not found", async () => {
    ownedLookupMock.mockResolvedValue({ data: null, error: null });

    const result = await updateProduct(input());

    expect(lookupFilters).toContainEqual(["companies.clerk_user_id", "user_123"]);
    expect(result).toMatchObject({ ok: false, code: "not_found" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("AC-2: refuses to edit a product an admin hid", async () => {
    ownedLookupMock.mockResolvedValue(ownedProduct({ status: "hidden" }));

    await expect(updateProduct(input())).resolves.toMatchObject({ ok: false, code: "product_hidden" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("refuses when the supplier's company is no longer approved", async () => {
    ownedLookupMock.mockResolvedValue(ownedProduct({ companyStatus: "hidden" }));

    await expect(updateProduct(input())).resolves.toMatchObject({ ok: false, code: "company_not_approved" });
  });

  it("rejects a kept image the product doesn't have, so an edit can't point at an arbitrary URL", async () => {
    const result = await updateProduct(input({ keepImageUrls: ["https://evil.example/x.png"] }));

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("requires at least one image in total", async () => {
    const result = await updateProduct(input({ keepImageUrls: [], newImages: [] }));

    expect(result).toMatchObject({ ok: false, code: "invalid_input", fieldErrors: { images: expect.any(String) } });
  });

  it("AC-2: saves kept then new images through update_product_submission, deletes only the dropped image, and refreshes the pages", async () => {
    const result = await updateProduct(input({ keepImageUrls: [OLD_B], newImages: [png()] }));

    expect(result).toEqual({ ok: true });
    const [fn, args] = rpcMock.mock.calls[0];
    expect(fn).toBe("update_product_submission");
    expect(args).toMatchObject({ p_clerk_user_id: "user_123", p_product_id: PRODUCT_ID, p_category_id: CATEGORY });
    expect(args.p_image_urls[0]).toBe(OLD_B);
    expect(args.p_image_urls).toHaveLength(2);
    expect(deleteFromR2Mock).toHaveBeenCalledTimes(1);
    expect(deleteFromR2Mock).toHaveBeenCalledWith("products", "user_123/a.webp");
    expect(revalidatePathMock).toHaveBeenCalledWith("/products/agarwood-chips");
    expect(revalidatePathMock).toHaveBeenCalledWith("/companies/avadi-herbs");
  });

  it("cleans up newly uploaded images and keeps the old ones when the database refuses the edit", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "P0006", message: "rate_limited" } });

    const result = await updateProduct(input({ keepImageUrls: [OLD_A], newImages: [png()] }));

    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
    const deletedKeys = deleteFromR2Mock.mock.calls.map(([, key]) => key);
    expect(deletedKeys).not.toContain("user_123/a.webp");
    expect(deletedKeys).not.toContain("user_123/b.webp");
    expect(deletedKeys).toHaveLength(1);
  });
});

describe("deleteProduct", () => {
  it("AC-4: treats another supplier's product as not found and deletes nothing", async () => {
    ownedLookupMock.mockResolvedValue({ data: null, error: null });

    const result = await deleteProduct(PRODUCT_ID);

    expect(lookupFilters).toContainEqual(["companies.clerk_user_id", "user_123"]);
    expect(result).toMatchObject({ ok: false, code: "not_found" });
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("AC-3: deletes every image, then the row, and refreshes the public pages", async () => {
    const result = await deleteProduct(PRODUCT_ID);

    expect(result).toEqual({ ok: true });
    expect(deleteFromR2Mock).toHaveBeenCalledTimes(2);
    expect(deleteMock).toHaveBeenCalledWith("id", PRODUCT_ID);
    expect(revalidatePathMock).toHaveBeenCalledWith("/products/agarwood-chips");
  });

  it("works on a hidden product too", async () => {
    ownedLookupMock.mockResolvedValue(ownedProduct({ status: "hidden" }));

    await expect(deleteProduct(PRODUCT_ID)).resolves.toEqual({ ok: true });
  });

  it("keeps the row when an image can't be deleted, so a retry can finish", async () => {
    deleteFromR2Mock.mockRejectedValueOnce(new Error("R2 down"));

    const result = await deleteProduct(PRODUCT_ID);

    expect(result).toMatchObject({ ok: false, code: "server_error" });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("rejects a product id that isn't a uuid without reading anything", async () => {
    await expect(deleteProduct("not-a-uuid")).resolves.toMatchObject({ ok: false, code: "not_found" });
    expect(ownedLookupMock).not.toHaveBeenCalled();
  });
});

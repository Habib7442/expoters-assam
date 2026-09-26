import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const lookupMock = vi.fn();
const deleteEqMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => lookupMock() }) }),
      delete: () => ({ eq: (...args: unknown[]) => deleteEqMock(...args) }),
    }),
  },
}));

const deleteFromR2Mock = vi.fn();
const R2 = "https://images.exportersasssm.com";
vi.mock("@/lib/storage/r2", () => ({
  deleteFromR2: (...args: unknown[]) => deleteFromR2Mock(...args),
  parseR2Url: (url: string) => {
    if (!url.startsWith(`${R2}/`)) return null;
    const [category, ...rest] = url.slice(R2.length + 1).split("/");
    return { category, key: rest.join("/") };
  },
}));

import { deleteSupplierData } from "./supplier-deletion";

describe("deleteSupplierData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteEqMock.mockResolvedValue({ error: null });
    deleteFromR2Mock.mockResolvedValue(undefined);
  });

  it("does nothing for a user with no business listing (and so is safe to retry)", async () => {
    lookupMock.mockResolvedValue({ data: null, error: null });

    await expect(deleteSupplierData("user_1")).resolves.toEqual({ companyDeleted: false, imagesDeleted: 0 });
    expect(deleteEqMock).not.toHaveBeenCalled();
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });

  it("deletes the company row, then every logo and product image once", async () => {
    lookupMock.mockResolvedValue({
      data: {
        id: "c1",
        logo_url: `${R2}/logos/user_1/logo.png`,
        products: [
          { image_url: `${R2}/products/user_1/a.png`, gallery_urls: [`${R2}/products/user_1/a.png`, `${R2}/products/user_1/b.png`] },
        ],
      },
      error: null,
    });

    const result = await deleteSupplierData("user_1");

    expect(deleteEqMock).toHaveBeenCalledWith("id", "c1");
    expect(deleteFromR2Mock.mock.calls.map(([category, key]) => `${category}/${key}`).sort()).toEqual([
      "logos/user_1/logo.png",
      "products/user_1/a.png",
      "products/user_1/b.png",
    ]);
    expect(result).toEqual({ companyDeleted: true, imagesDeleted: 3 });
  });

  it("skips images that aren't on our R2 host", async () => {
    lookupMock.mockResolvedValue({
      data: { id: "c1", logo_url: "https://old.supabase.co/logo.png", products: [] },
      error: null,
    });

    const result = await deleteSupplierData("user_1");

    expect(deleteFromR2Mock).not.toHaveBeenCalled();
    expect(result).toEqual({ companyDeleted: true, imagesDeleted: 0 });
  });

  it("still reports the company deleted when an image delete fails (best effort)", async () => {
    lookupMock.mockResolvedValue({ data: { id: "c1", logo_url: `${R2}/logos/user_1/logo.png`, products: [] }, error: null });
    deleteFromR2Mock.mockRejectedValue(new Error("network"));

    await expect(deleteSupplierData("user_1")).resolves.toEqual({ companyDeleted: true, imagesDeleted: 0 });
  });

  it("throws, deleting no images, when the company delete fails, so the webhook is retried", async () => {
    lookupMock.mockResolvedValue({ data: { id: "c1", logo_url: `${R2}/logos/user_1/logo.png`, products: [] }, error: null });
    deleteEqMock.mockResolvedValue({ error: { message: "boom" } });

    await expect(deleteSupplierData("user_1")).rejects.toEqual({ message: "boom" });
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });

  it("throws when the lookup fails", async () => {
    lookupMock.mockResolvedValue({ data: null, error: { message: "timeout" } });

    await expect(deleteSupplierData("user_1")).rejects.toEqual({ message: "timeout" });
  });
});

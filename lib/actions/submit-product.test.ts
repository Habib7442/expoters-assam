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

const rpcMock = vi.fn();
const companyLookupMock = vi.fn();
const recentCountMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (table: string) =>
      table === "companies"
        ? { select: () => ({ eq: () => ({ maybeSingle: () => companyLookupMock() }) }) }
        : { select: () => ({ eq: () => ({ gt: () => recentCountMock() }) }) },
  },
}));

const uploadToR2Mock = vi.fn();
const deleteFromR2Mock = vi.fn();
vi.mock("@/lib/storage/r2", () => ({
  uploadToR2: (...args: unknown[]) => uploadToR2Mock(...args),
  deleteFromR2: (...args: unknown[]) => deleteFromR2Mock(...args),
}));

import { submitProduct, type SubmitProductInput } from "./submit-product";

// Real, decodable images: the action checks magic bytes and decodes them.
let PNG_BYTES: Uint8Array<ArrayBuffer>;
beforeAll(async () => {
  PNG_BYTES = new Uint8Array(
    await sharp({ create: { width: 4, height: 4, channels: 3, background: "#2e7d32" } }).png().toBuffer(),
  );
});

const png = (name = "a.png") => new File([PNG_BYTES], name, { type: "image/png" });
const CATEGORY = "3f2b6c1e-8a4d-4f7e-9b1a-2c5d8e0f1a2b";
const input = (overrides: Partial<SubmitProductInput> = {}): SubmitProductInput => ({
  name: "Assam agarwood chips",
  description: "Grade A",
  categoryId: CATEGORY,
  images: [png("a.png"), png("b.png")],
  ...overrides,
});

describe("submitProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user_123" });
    companyLookupMock.mockResolvedValue({ data: { id: "c1", status: "approved" }, error: null });
    recentCountMock.mockResolvedValue({ count: 0, error: null });
    let n = 0;
    uploadToR2Mock.mockImplementation(async (_category: string, key: string) => `https://images.exportersasssm.com/products/${key}#${n++}`);
    deleteFromR2Mock.mockResolvedValue(undefined);
    rpcMock.mockResolvedValue({ data: [{ product_id: "p1", status: "pending" }], error: null });
  });

  it("refuses a signed out caller before touching anything", async () => {
    authMock.mockResolvedValue({ userId: null });

    const result = await submitProduct(input());

    expect(result).toMatchObject({ ok: false, code: "not_signed_in" });
    expect(companyLookupMock).not.toHaveBeenCalled();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it("uploads every image under the caller's own folder, then creates a pending product with those URLs", async () => {
    const result = await submitProduct(input());

    expect(result).toEqual({ ok: true, productId: "p1", status: "pending" });
    expect(uploadToR2Mock).toHaveBeenCalledTimes(2);
    for (const [category, key] of uploadToR2Mock.mock.calls) {
      expect(category).toBe("products");
      expect(key).toMatch(/^user_123\/[0-9a-f-]{36}\.png$/);
    }
    expect(rpcMock).toHaveBeenCalledWith("create_product_submission", {
      p_clerk_user_id: "user_123",
      p_name: "Assam agarwood chips",
      p_description: "Grade A",
      p_category_id: CATEGORY,
      p_image_urls: [expect.stringContaining("/products/user_123/"), expect.stringContaining("/products/user_123/")],
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/products/new");
  });

  it.each([
    ["no images", { images: [] }, "images"],
    ["six images", { images: Array.from({ length: 6 }, (_, i) => png(`${i}.png`)) }, "images"],
    ["an image over 2 MB", { images: [new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })] }, "images"],
    ["a GIF", { images: [new File([PNG_BYTES], "a.gif", { type: "image/gif" })] }, "images"],
    ["a one letter name", { name: "A" }, "name"],
    ["no category", { categoryId: "" }, "categoryId"],
  ])("rejects %s with a field error, before uploading anything", async (_label, overrides, field) => {
    const result = await submitProduct(input(overrides as Partial<SubmitProductInput>));

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(result.ok === false && result.fieldErrors?.[field]).toBeTruthy();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["has no company", { data: null, error: null }],
    ["has a pending company", { data: { id: "c1", status: "pending" }, error: null }],
    ["has a rejected company", { data: { id: "c1", status: "rejected" }, error: null }],
  ])("refuses a caller who %s, before uploading anything", async (_label, lookup) => {
    companyLookupMock.mockResolvedValue(lookup);

    const result = await submitProduct(input());

    expect(result).toMatchObject({ ok: false, code: "company_not_approved" });
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it("stops at the hourly cap before uploading anything (spec 0006, AC-6)", async () => {
    recentCountMock.mockResolvedValue({ count: 30, error: null });

    const result = await submitProduct(input());

    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it("rejects the whole submission if any one file is not a real image, uploading none of them", async () => {
    const fake = new File(["<html></html>"], "fake.png", { type: "image/png" });

    const result = await submitProduct(input({ images: [png(), fake] }));

    expect(result.ok === false && result.fieldErrors?.images).toBeTruthy();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it("deletes the images that did upload when another upload fails", async () => {
    uploadToR2Mock
      .mockImplementationOnce(async (_c: string, key: string) => `https://images.exportersasssm.com/products/${key}`)
      .mockRejectedValueOnce(new Error("network"));

    const result = await submitProduct(input());

    expect(result).toMatchObject({ ok: false, code: "upload_failed" });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(deleteFromR2Mock).toHaveBeenCalledTimes(1);
    expect(deleteFromR2Mock.mock.calls[0][0]).toBe("products");
  });

  it.each([
    ["P0007", "company_not_approved"],
    ["P0010", "rate_limited"],
    ["XX000", "server_error"],
  ])("maps database error %s to %s and deletes the uploaded images", async (code, expected) => {
    rpcMock.mockResolvedValue({ data: null, error: { code, message: "x" } });

    const result = await submitProduct(input());

    expect(result).toMatchObject({ ok: false, code: expected });
    expect(deleteFromR2Mock).toHaveBeenCalledTimes(2);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("never deletes anything after a successful submission", async () => {
    await submitProduct(input());

    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });

  it("reports an empty database result as a server error and cleans up", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const result = await submitProduct(input());

    expect(result).toMatchObject({ ok: false, code: "server_error" });
    expect(deleteFromR2Mock).toHaveBeenCalledTimes(2);
  });
});

describe("submitProduct upload cleanup timing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user_123" });
    companyLookupMock.mockResolvedValue({ data: { id: "c1", status: "approved" }, error: null });
    recentCountMock.mockResolvedValue({ count: 0, error: null });
    deleteFromR2Mock.mockResolvedValue(undefined);
  });

  it("also deletes an upload that finishes after another one has already failed", async () => {
    uploadToR2Mock
      .mockImplementationOnce(async () => {
        throw new Error("fast failure");
      })
      .mockImplementationOnce(async (_c: string, key: string) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return `https://images.exportersasssm.com/products/${key}`;
      });

    const result = await submitProduct(input());

    expect(result).toMatchObject({ ok: false, code: "upload_failed" });
    expect(deleteFromR2Mock).toHaveBeenCalledTimes(1);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

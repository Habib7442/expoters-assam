import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createR2ClientMock = vi.fn<(...args: unknown[]) => { __brand: string }>(() => ({ __brand: "r2-client" }));
const uploadToR2CoreMock = vi.fn<(...args: unknown[]) => Promise<string>>(async () => "https://images.exportersasssm.com/products/x.webp");
const deleteFromR2CoreMock = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
const parseR2UrlCoreMock = vi.fn<(...args: unknown[]) => { category: "products"; key: string }>(() => ({
  category: "products",
  key: "x.webp",
}));

vi.mock("@/lib/storage/r2-client", () => ({
  createR2Client: (...args: unknown[]) => createR2ClientMock(...args),
  uploadToR2: (...args: unknown[]) => uploadToR2CoreMock(...args),
  deleteFromR2: (...args: unknown[]) => deleteFromR2CoreMock(...args),
  parseR2Url: (...args: unknown[]) => parseR2UrlCoreMock(...args),
}));

const ORIGINAL_ENV = { ...process.env };
const REQUIRED_VARS = {
  R2_ACCOUNT_ID: "acct-1",
  R2_ACCESS_KEY_ID: "key-1",
  R2_SECRET_ACCESS_KEY: "secret-1",
  R2_BUCKET: "exportsassam-images",
  R2_PUBLIC_IMAGE_DOMAIN: "images.exportersasssm.com",
};
const CONFIG = { bucket: REQUIRED_VARS.R2_BUCKET, publicDomain: REQUIRED_VARS.R2_PUBLIC_IMAGE_DOMAIN };

describe("lib/storage/r2", () => {
  beforeEach(() => {
    vi.resetModules();
    createR2ClientMock.mockClear();
    uploadToR2CoreMock.mockClear();
    deleteFromR2CoreMock.mockClear();
    parseR2UrlCoreMock.mockClear();
    process.env = { ...ORIGINAL_ENV, ...REQUIRED_VARS };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("builds the client once at import time from the five required env vars", async () => {
    await import("./r2");

    expect(createR2ClientMock).toHaveBeenCalledTimes(1);
    expect(createR2ClientMock).toHaveBeenCalledWith({
      accountId: "acct-1",
      accessKeyId: "key-1",
      secretAccessKey: "secret-1",
    });
  });

  // covers: AC-2 / Key invariants (fail fast with a named error, never a silent undefined)
  it.each(Object.keys(REQUIRED_VARS))("throws a named error at import time when %s is missing", async (missing) => {
    delete process.env[missing];

    await expect(import("./r2")).rejects.toThrow(new RegExp(missing));
    expect(createR2ClientMock).not.toHaveBeenCalled();
  });

  it("uploadToR2 delegates to the core function with the closed-over client and config", async () => {
    const { uploadToR2 } = await import("./r2");
    const file = new Uint8Array([1, 2, 3]);

    await uploadToR2("logos", "user_1/uuid.png", file, "image/png");

    expect(uploadToR2CoreMock).toHaveBeenCalledWith(
      { __brand: "r2-client" },
      CONFIG,
      "logos",
      "user_1/uuid.png",
      file,
      "image/png",
    );
  });

  it("deleteFromR2 delegates to the core function with the closed-over client and config", async () => {
    const { deleteFromR2 } = await import("./r2");

    await deleteFromR2("products", "demo/agarwood-chips.webp");

    expect(deleteFromR2CoreMock).toHaveBeenCalledWith(
      { __brand: "r2-client" },
      CONFIG,
      "products",
      "demo/agarwood-chips.webp",
    );
  });

  it("parseR2Url delegates to the core function with the closed-over public domain", async () => {
    const { parseR2Url } = await import("./r2");
    const url = "https://images.exportersasssm.com/products/x.webp";

    const result = parseR2Url(url);

    expect(parseR2UrlCoreMock).toHaveBeenCalledWith(REQUIRED_VARS.R2_PUBLIC_IMAGE_DOMAIN, url);
    expect(result).toEqual({ category: "products", key: "x.webp" });
  });
});

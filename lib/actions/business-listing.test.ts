import { beforeEach, describe, expect, it, vi } from "vitest";

// This suite covers only the R2 storage surface of business-listing.ts (the
// spec 0004 migration off Supabase Storage): upload key/category shape, the
// upload-failure guard, and the delete-on-replace best-effort behavior.
// submitBusinessListing/updateBusinessListing's own validation and RPC error
// branches are spec 0005's surface and are covered under that feature's own
// /test pass, not repeated here.

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

const rpcMock = vi.fn();
const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

const uploadToR2Mock = vi.fn();
const deleteFromR2Mock = vi.fn();
const parseR2UrlMock = vi.fn();
vi.mock("@/lib/storage/r2", () => ({
  uploadToR2: (...args: unknown[]) => uploadToR2Mock(...args),
  deleteFromR2: (...args: unknown[]) => deleteFromR2Mock(...args),
  parseR2Url: (...args: unknown[]) => parseR2UrlMock(...args),
}));

import { submitBusinessListing, updateBusinessListing } from "./business-listing";

function makeLogoFile(type = "image/webp") {
  return new File([new Uint8Array([1, 2, 3])], "logo.webp", { type });
}

function unchangedLogoFile() {
  return new File([], "unchanged.webp", { type: "image/webp" });
}

function baseFormData() {
  const fd = new FormData();
  fd.set("name", "Demo Exporters");
  fd.set("addressLine", "12 GS Road, Christian Basti");
  fd.set("location", "Guwahati");
  fd.set("state", "Assam");
  fd.set("country", "India");
  fd.set("email", "owner@example.com");
  fd.set("whatsappNumber", "+919812345678");
  fd.set("consent", "on");
  return fd;
}

function mockExistingLogo(logoUrl: string | null) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: logoUrl ? { logo_url: logoUrl } : null }),
      }),
    }),
  });
}

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("submitBusinessListing logo upload (R2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user_123" });
  });

  it("uploads under the logos category with a clerkUserId-prefixed key, and passes the R2 URL to the RPC", async () => {
    uploadToR2Mock.mockResolvedValue("https://images.exportersasssm.com/logos/user_123/uuid.webp");
    rpcMock.mockResolvedValue({ data: [{ company_id: "c1", status: "pending" }], error: null });

    const fd = baseFormData();
    fd.set("logo", makeLogoFile());

    const result = await submitBusinessListing(fd);

    expect(uploadToR2Mock).toHaveBeenCalledTimes(1);
    const [category, key] = uploadToR2Mock.mock.calls[0]!;
    expect(category).toBe("logos");
    expect(key).toMatch(/^user_123\/[0-9a-f-]{36}\.webp$/);

    expect(rpcMock).toHaveBeenCalledWith(
      "create_business_listing",
      expect.objectContaining({ p_logo_url: "https://images.exportersasssm.com/logos/user_123/uuid.webp" }),
    );
    expect(result).toEqual({ ok: true, companyId: "c1", status: "pending" });
  });

  it("returns upload_failed and never calls the RPC when the R2 upload throws", async () => {
    uploadToR2Mock.mockRejectedValue(new Error("network error"));

    const fd = baseFormData();
    fd.set("logo", makeLogoFile());

    const result = await submitBusinessListing(fd);

    expect(result).toMatchObject({ ok: false, code: "upload_failed" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("maps a duplicate clerk_user_id to already_listed", async () => {
    uploadToR2Mock.mockResolvedValue("https://images.exportersasssm.com/logos/user_123/uuid.webp");
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "companies_clerk_user_id_key"' },
    });

    const fd = baseFormData();
    fd.set("logo", makeLogoFile());

    expect(await submitBusinessListing(fd)).toMatchObject({ ok: false, code: "already_listed" });
  });

  it("does not report a slug collision as already_listed", async () => {
    uploadToR2Mock.mockResolvedValue("https://images.exportersasssm.com/logos/user_123/uuid.webp");
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "companies_slug_key"' },
    });

    const fd = baseFormData();
    fd.set("logo", makeLogoFile());

    expect(await submitBusinessListing(fd)).toMatchObject({ ok: false, code: "server_error" });
  });

  it("rejects a listing submitted without DPDP consent, before uploading or writing anything", async () => {
    const fd = baseFormData();
    fd.delete("consent");
    fd.set("logo", makeLogoFile());

    const result = await submitBusinessListing(fd);

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(result.ok === false && result.fieldErrors?.consent).toBeTruthy();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("updateBusinessListing logo replace (R2 delete-on-replace)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user_123" });
    rpcMock.mockResolvedValue({ data: [{ company_id: "c1", status: "pending" }], error: null });
  });

  it("deletes the old R2 logo once a new one replaces it", async () => {
    mockExistingLogo("https://images.exportersasssm.com/logos/user_123/old.webp");
    uploadToR2Mock.mockResolvedValue("https://images.exportersasssm.com/logos/user_123/new.webp");
    parseR2UrlMock.mockReturnValue({ category: "logos", key: "user_123/old.webp" });

    const fd = baseFormData();
    fd.set("logo", makeLogoFile());

    await updateBusinessListing(fd);
    await flushMicrotasks();

    expect(parseR2UrlMock).toHaveBeenCalledWith("https://images.exportersasssm.com/logos/user_123/old.webp");
    expect(deleteFromR2Mock).toHaveBeenCalledWith("logos", "user_123/old.webp");
  });

  it("does not upload or delete anything when no new logo file is submitted", async () => {
    mockExistingLogo("https://images.exportersasssm.com/logos/user_123/old.webp");

    const fd = baseFormData();
    fd.set("logo", unchangedLogoFile());

    await updateBusinessListing(fd);
    await flushMicrotasks();

    expect(uploadToR2Mock).not.toHaveBeenCalled();
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });

  it("does not call deleteFromR2 when the old logo URL doesn't parse as one of ours", async () => {
    mockExistingLogo("https://some-legacy-host.example/old.webp");
    uploadToR2Mock.mockResolvedValue("https://images.exportersasssm.com/logos/user_123/new.webp");
    parseR2UrlMock.mockReturnValue(null);

    const fd = baseFormData();
    fd.set("logo", makeLogoFile());

    await updateBusinessListing(fd);
    await flushMicrotasks();

    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });

  it("still returns ok when the best-effort delete of the old logo fails", async () => {
    mockExistingLogo("https://images.exportersasssm.com/logos/user_123/old.webp");
    uploadToR2Mock.mockResolvedValue("https://images.exportersasssm.com/logos/user_123/new.webp");
    parseR2UrlMock.mockReturnValue({ category: "logos", key: "user_123/old.webp" });
    deleteFromR2Mock.mockRejectedValue(new Error("object not found"));

    const fd = baseFormData();
    fd.set("logo", makeLogoFile());

    const result = await updateBusinessListing(fd);
    await flushMicrotasks();

    expect(result.ok).toBe(true);
  });
});

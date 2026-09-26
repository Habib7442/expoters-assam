import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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

// A real, decodable WebP: the action verifies magic bytes and fully decodes
// the image, never trusting the browser-claimed type.
let WEBP_BYTES: Uint8Array<ArrayBuffer>;
beforeAll(async () => {
  const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#2e7d32" } })
    .webp()
    .toBuffer();
  WEBP_BYTES = new Uint8Array(buffer);
});

function makeLogoFile(type = "image/webp") {
  return new File([WEBP_BYTES], "logo.webp", { type });
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

/** The caller's existing listing, as update/submit look it up. The stored name differs from the form's, so a save counts as a change. */
function mockExistingListing(row: Record<string, unknown> | null, error: { message: string } | null = null) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: row, error }),
      }),
    }),
  });
}

function mockExistingLogo(logoUrl: string | null) {
  mockExistingListing({ id: "c1", logo_url: logoUrl, status: "pending", updated_at: null, name: "Old name", country: "India" });
}

function mockNoCompanyYet() {
  mockExistingListing(null);
}

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("submitBusinessListing logo upload (R2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user_123" });
    mockNoCompanyYet();
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

  it("rejects a non-image disguised as image/png, before uploading anything", async () => {
    const fd = baseFormData();
    fd.set("logo", new File(["<html><script>alert(1)</script></html>"], "logo.png", { type: "image/png" }));

    const result = await submitBusinessListing(fd);

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(result.ok === false && result.fieldErrors?.logo).toBeTruthy();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("stores the logo under its detected type, not the browser-claimed one", async () => {
    uploadToR2Mock.mockResolvedValue("https://images.exportersasssm.com/logos/user_123/uuid.webp");
    rpcMock.mockResolvedValue({ data: [{ company_id: "c1", status: "pending" }], error: null });

    const fd = baseFormData();
    fd.set("logo", makeLogoFile("image/jpeg"));

    await submitBusinessListing(fd);

    const [, key, , contentType] = uploadToR2Mock.mock.calls[0]!;
    expect(key).toMatch(/\.webp$/);
    expect(contentType).toBe("image/webp");
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

describe("submitBusinessListing validation and errors (spec 0005)", () => {
  const LOGO_URL = "https://images.exportersasssm.com/logos/user_123/uuid.webp";

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user_123" });
    mockNoCompanyYet();
    parseR2UrlMock.mockReturnValue({ category: "logos", key: "user_123/uuid.webp" });
    uploadToR2Mock.mockResolvedValue(LOGO_URL);
  });

  function validFormData() {
    const fd = baseFormData();
    fd.set("logo", makeLogoFile());
    return fd;
  }

  it("refuses a signed out caller before uploading or writing anything (AC-1)", async () => {
    authMock.mockResolvedValue({ userId: null });

    const result = await submitBusinessListing(validFormData());

    expect(result).toMatchObject({ ok: false, code: "not_signed_in" });
    expect(uploadToR2Mock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns a field error for every missing required field, and writes nothing (AC-3)", async () => {
    const fd = new FormData();
    fd.set("logo", new File([], "", { type: "application/octet-stream" }));

    const result = await submitBusinessListing(fd);

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    const fields = Object.keys(result.ok === false ? (result.fieldErrors ?? {}) : {});
    expect(fields).toEqual(
      expect.arrayContaining(["name", "addressLine", "location", "state", "email", "whatsappNumber", "logo", "consent"]),
    );
    expect(uploadToR2Mock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects a WhatsApp number with fewer than 10 digits as a field error (AC-3)", async () => {
    const fd = validFormData();
    fd.set("whatsappNumber", "+91 123");

    const result = await submitBusinessListing(fd);

    expect(result.ok === false && result.fieldErrors?.whatsappNumber).toBeTruthy();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("creates the listing through create_business_listing with consent recorded, and refreshes the page (AC-2)", async () => {
    rpcMock.mockResolvedValue({ data: [{ company_id: "c1", status: "pending" }], error: null });

    const result = await submitBusinessListing(validFormData());

    expect(result).toEqual({ ok: true, companyId: "c1", status: "pending" });
    expect(rpcMock).toHaveBeenCalledWith(
      "create_business_listing",
      expect.objectContaining({
        p_clerk_user_id: "user_123",
        p_name: "Demo Exporters",
        p_whatsapp_number: "+919812345678",
        p_email: "owner@example.com",
        p_consent_notice_version: expect.any(String),
        p_about: null,
        p_postal_code: null,
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/list-business");
  });

  it.each([
    ["the WhatsApp format check", { code: "23514", message: 'violates check constraint "company_contacts_whatsapp_number_check"' }, "whatsappNumber"],
    ["the email format check", { code: "23514", message: 'violates check constraint "companies_email_check"' }, "email"],
  ])("maps a database failure of %s to that field's error (AC-3)", async (_label, error, field) => {
    rpcMock.mockResolvedValue({ data: null, error });

    const result = await submitBusinessListing(validFormData());

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(result.ok === false && result.fieldErrors?.[field]).toBeTruthy();
  });

  it.each([
    ["an unexpected database error", { data: null, error: { code: "XX000", message: "boom" } }],
    ["an empty result", { data: [], error: null }],
  ])("reports %s as a server error", async (_label, response) => {
    rpcMock.mockResolvedValue(response);

    const result = await submitBusinessListing(validFormData());

    expect(result).toMatchObject({ ok: false, code: "server_error" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("updateBusinessListing errors (spec 0005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user_123" });
    mockExistingLogo(null);
  });

  function editFormData() {
    const fd = baseFormData();
    fd.delete("consent");
    fd.set("logo", unchangedLogoFile());
    return fd;
  }

  it("refuses a signed out caller before writing anything", async () => {
    authMock.mockResolvedValue({ userId: null });

    const result = await updateBusinessListing(editFormData());

    expect(result).toMatchObject({ ok: false, code: "not_signed_in" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("saves an edit without asking for consent again, and returns the new status (AC-5)", async () => {
    rpcMock.mockResolvedValue({ data: [{ company_id: "c1", status: "pending" }], error: null });

    const result = await updateBusinessListing(editFormData());

    expect(result).toEqual({ ok: true, companyId: "c1", status: "pending" });
    expect(rpcMock).toHaveBeenCalledWith("update_business_listing", expect.objectContaining({ p_logo_url: null }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/list-business");
  });

  it.each([
    ["P0004", "not_found"],
    ["P0006", "rate_limited"],
    ["XX000", "server_error"],
  ])("maps database error %s to %s", async (code, expected) => {
    rpcMock.mockResolvedValue({ data: null, error: { code, message: "x" } });

    const result = await updateBusinessListing(editFormData());

    expect(result).toMatchObject({ ok: false, code: expected });
  });
});

describe("business listing never wastes or orphans an R2 upload (review 2026-09-26)", () => {
  const NEW_LOGO = "https://images.exportersasssm.com/logos/user_123/new.webp";

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user_123" });
    uploadToR2Mock.mockResolvedValue(NEW_LOGO);
    parseR2UrlMock.mockImplementation((url: string) => ({ category: "logos", key: url.split("/logos/")[1] }));
    deleteFromR2Mock.mockResolvedValue(undefined);
  });

  function createFormData() {
    const fd = baseFormData();
    fd.set("logo", makeLogoFile());
    return fd;
  }

  function editFormData(logo: File = unchangedLogoFile()) {
    const fd = baseFormData();
    fd.delete("consent");
    fd.set("logo", logo);
    return fd;
  }

  const storedListing = {
    id: "c1",
    logo_url: "https://images.exportersasssm.com/logos/user_123/old.webp",
    status: "approved",
    updated_at: null,
    name: "Demo Exporters",
    address_line: "12 GS Road, Christian Basti",
    location: "Guwahati",
    state: "Assam",
    postal_code: null,
    country: "India",
    about: null,
    email: "owner@example.com",
    gst_number: null,
    company_contacts: { whatsapp_number: "+919812345678" },
  };

  it("refuses a second listing before uploading anything", async () => {
    mockExistingListing({ id: "c1" });

    const result = await submitBusinessListing(createFormData());

    expect(result).toMatchObject({ ok: false, code: "already_listed" });
    expect(uploadToR2Mock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("stops with a server error, uploading nothing, when the existing listing lookup fails", async () => {
    mockExistingListing(null, { message: "timeout" });

    const result = await submitBusinessListing(createFormData());

    expect(result).toMatchObject({ ok: false, code: "server_error" });
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it("deletes the uploaded logo when creating the listing then fails", async () => {
    mockNoCompanyYet();
    rpcMock.mockResolvedValue({ data: null, error: { code: "23505", message: 'violates "companies_clerk_user_id_key"' } });

    const result = await submitBusinessListing(createFormData());

    expect(result).toMatchObject({ ok: false, code: "already_listed" });
    expect(deleteFromR2Mock).toHaveBeenCalledWith("logos", "user_123/new.webp");
  });

  it("saving an unchanged approved listing keeps it live: no database write, no upload", async () => {
    mockExistingListing(storedListing);

    const result = await updateBusinessListing(editFormData());

    expect(result).toEqual({ ok: true, companyId: "c1", status: "approved" });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it("treats a stored lowercase country as unchanged, so normalization alone never sends a listing to review", async () => {
    mockExistingListing({ ...storedListing, country: "india" });

    const result = await updateBusinessListing(editFormData());

    expect(result).toEqual({ ok: true, companyId: "c1", status: "approved" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("still treats a genuinely different country as a change", async () => {
    mockExistingListing({ ...storedListing, country: "Bhutan" });
    rpcMock.mockResolvedValue({ data: [{ company_id: "c1", status: "pending" }], error: null });

    await updateBusinessListing(editFormData());

    expect(rpcMock).toHaveBeenCalledWith("update_business_listing", expect.objectContaining({ p_country: "India" }));
  });

  it("treats a changed field as a real edit", async () => {
    mockExistingListing({ ...storedListing, about: "Old about" });
    rpcMock.mockResolvedValue({ data: [{ company_id: "c1", status: "pending" }], error: null });

    const result = await updateBusinessListing(editFormData());

    expect(result).toEqual({ ok: true, companyId: "c1", status: "pending" });
    expect(rpcMock).toHaveBeenCalledWith("update_business_listing", expect.anything());
  });

  it("applies the 10 second cooldown before uploading a new logo", async () => {
    mockExistingListing({ ...storedListing, about: "Old about", updated_at: new Date(Date.now() - 3000).toISOString() });

    const result = await updateBusinessListing(editFormData(makeLogoFile()));

    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it("returns not_found, writing nothing, when the caller has no listing", async () => {
    mockExistingListing(null);

    const result = await updateBusinessListing(editFormData());

    expect(result).toMatchObject({ ok: false, code: "not_found" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("stops with a server error when the existing listing lookup fails", async () => {
    mockExistingListing(null, { message: "timeout" });

    const result = await updateBusinessListing(editFormData(makeLogoFile()));

    expect(result).toMatchObject({ ok: false, code: "server_error" });
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it("deletes the new logo, and keeps the old one, when the edit then fails", async () => {
    mockExistingListing({ ...storedListing, about: "Old about" });
    rpcMock.mockResolvedValue({ data: null, error: { code: "P0006", message: "rate_limited" } });

    const result = await updateBusinessListing(editFormData(makeLogoFile()));

    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
    expect(deleteFromR2Mock).toHaveBeenCalledTimes(1);
    expect(deleteFromR2Mock).toHaveBeenCalledWith("logos", "user_123/new.webp");
  });
});

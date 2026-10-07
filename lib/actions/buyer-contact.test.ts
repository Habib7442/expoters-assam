import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

const rpcMock = vi.fn();
const companyMock = vi.fn();
const requirementMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => {
  // A chainable stand in for the query builder: every filter returns itself,
  // and the terminal call resolves to the table's mock.
  const builder = (resolve: () => unknown) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq"]) chain[method] = () => chain;
    chain.maybeSingle = () => resolve();
    chain.single = () => resolve();
    return chain;
  };
  return {
    supabaseAdmin: {
      rpc: (...args: unknown[]) => rpcMock(...args),
      from: (table: string) => builder(table === "companies" ? companyMock : requirementMock),
    },
  };
});

const getContactAllowanceMock = vi.fn();
const getUnlockedContactMock = vi.fn();
vi.mock("@/lib/supabase/queries/buyer-contacts", () => ({
  getContactAllowance: (...args: unknown[]) => getContactAllowanceMock(...args),
  getUnlockedContact: (...args: unknown[]) => getUnlockedContactMock(...args),
}));

import { getBuyerContactStatus, unlockBuyerContact } from "./buyer-contact";

const REQUIREMENT_ID = "3f2b6c1e-8a4d-4f7e-9b1a-2c5d8e0f1a2b";
const SILVER = { tier: "silver", quota: 15, used: 3, remaining: 12, periodStart: "2026-10-01T00:00:00Z" };
const CONTACT = {
  buyRequirementId: REQUIREMENT_ID,
  name: "Ravi Kumar",
  phone: "+919876543210",
  email: "ravi@example.com",
  productText: "Black pepper",
  quantity: "500 kg",
  location: "Mumbai",
  notes: null,
  postedAt: "2026-10-07T05:00:00Z",
  unlockedAt: "2026-10-07T06:00:00Z",
};
const UNLOCK_ROW = {
  contact_name: "Ravi Kumar",
  phone: "+919876543210",
  email: "ravi@example.com",
  product_text: "Black pepper",
  quantity: "500 kg",
  location: "Mumbai",
  notes: null,
  posted_at: "2026-10-07T05:00:00Z",
  newly_unlocked: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: "user_123" });
  companyMock.mockResolvedValue({ data: { id: "c1", status: "approved" }, error: null });
  requirementMock.mockResolvedValue({ data: { contact_unlockable: true }, error: null });
  getContactAllowanceMock.mockResolvedValue(SILVER);
  getUnlockedContactMock.mockResolvedValue(null);
  rpcMock.mockResolvedValue({ data: [UNLOCK_ROW], error: null });
});

describe("getBuyerContactStatus", () => {
  it("asks a signed out visitor to sign in without touching the database", async () => {
    authMock.mockResolvedValue({ userId: null });

    await expect(getBuyerContactStatus(REQUIREMENT_ID)).resolves.toEqual({ kind: "signed_out" });
    expect(companyMock).not.toHaveBeenCalled();
  });

  it("tells a user with no listing to list their business", async () => {
    companyMock.mockResolvedValue({ data: null, error: null });

    await expect(getBuyerContactStatus(REQUIREMENT_ID)).resolves.toEqual({ kind: "no_company" });
  });

  it("holds back a supplier whose listing isn't approved yet", async () => {
    companyMock.mockResolvedValue({ data: { id: "c1", status: "pending" }, error: null });

    await expect(getBuyerContactStatus(REQUIREMENT_ID)).resolves.toEqual({ kind: "not_approved" });
  });

  it("shows an already unlocked buyer without using a contact", async () => {
    getUnlockedContactMock.mockResolvedValue(CONTACT);

    await expect(getBuyerContactStatus(REQUIREMENT_ID)).resolves.toEqual({ kind: "unlocked", contact: CONTACT, allowance: SILVER });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("offers the unlock with the contacts left", async () => {
    await expect(getBuyerContactStatus(REQUIREMENT_ID)).resolves.toEqual({ kind: "can_unlock", allowance: SILVER });
  });

  it("says the contacts are used up when none are left", async () => {
    const usedUp = { ...SILVER, used: 15, remaining: 0 };
    getContactAllowanceMock.mockResolvedValue(usedUp);

    await expect(getBuyerContactStatus(REQUIREMENT_ID)).resolves.toEqual({ kind: "exhausted", allowance: usedUp });
  });

  it("never offers an unlock for a requirement posted before buyers agreed to share", async () => {
    requirementMock.mockResolvedValue({ data: { contact_unlockable: false }, error: null });

    await expect(getBuyerContactStatus(REQUIREMENT_ID)).resolves.toEqual({ kind: "not_unlockable" });
  });

  it("reports a missing or hidden requirement", async () => {
    requirementMock.mockResolvedValue({ data: null, error: null });

    await expect(getBuyerContactStatus(REQUIREMENT_ID)).resolves.toEqual({ kind: "not_found" });
  });

  it("rejects a malformed id before any lookup", async () => {
    await expect(getBuyerContactStatus("not-a-uuid")).resolves.toEqual({ kind: "not_found" });
    expect(companyMock).not.toHaveBeenCalled();
  });

  it("returns a friendly error, not a crash, when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    companyMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(getBuyerContactStatus(REQUIREMENT_ID)).resolves.toMatchObject({ kind: "error" });
  });
});

describe("unlockBuyerContact", () => {
  it("refuses a signed out caller before calling the database", async () => {
    authMock.mockResolvedValue({ userId: null });

    await expect(unlockBuyerContact(REQUIREMENT_ID)).resolves.toMatchObject({ ok: false, code: "not_signed_in" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("unlocks through the database function with the caller's own Clerk id and returns the buyer", async () => {
    const result = await unlockBuyerContact(REQUIREMENT_ID);

    expect(rpcMock).toHaveBeenCalledWith("unlock_buy_requirement", {
      p_clerk_user_id: "user_123",
      p_buy_requirement_id: REQUIREMENT_ID,
    });
    expect(result).toMatchObject({
      ok: true,
      allowance: SILVER,
      contact: { name: "Ravi Kumar", phone: "+919876543210", email: "ravi@example.com", productText: "Black pepper" },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/my-buyer-contacts");
  });

  it("doesn't refresh the contacts page when the buyer was already unlocked", async () => {
    rpcMock.mockResolvedValue({ data: [{ ...UNLOCK_ROW, newly_unlocked: false }], error: null });

    await unlockBuyerContact(REQUIREMENT_ID);

    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it.each([
    ["P0007", "company_not_approved"],
    ["P0004", "not_found"],
    ["P0011", "not_unlockable"],
    ["P0012", "quota_exhausted"],
  ])("maps database error %s to %s", async (code, expected) => {
    rpcMock.mockResolvedValue({ data: null, error: { code, message: "x" } });

    await expect(unlockBuyerContact(REQUIREMENT_ID)).resolves.toMatchObject({ ok: false, code: expected });
  });

  it("still hands over the contact when only the remaining count fails to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getContactAllowanceMock.mockRejectedValue(new Error("boom"));

    await expect(unlockBuyerContact(REQUIREMENT_ID)).resolves.toMatchObject({
      ok: true,
      allowance: null,
      contact: { phone: "+919876543210" },
    });
  });

  it("rejects a malformed id before calling the database", async () => {
    await expect(unlockBuyerContact("x")).resolves.toMatchObject({ ok: false, code: "not_found" });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

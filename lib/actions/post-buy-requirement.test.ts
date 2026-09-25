import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

const verifyTurnstileMock = vi.fn();
vi.mock("@/lib/security/turnstile", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/turnstile")>("@/lib/security/turnstile");
  return { ...actual, verifyTurnstile: (...args: unknown[]) => verifyTurnstileMock(...args) };
});
vi.mock("server-only", () => ({}));

import { postBuyRequirement, type PostBuyRequirementInput } from "./post-buy-requirement";

const validInput: PostBuyRequirementInput = {
  name: "Asha Buyer",
  phone: "+91 98765 43210",
  email: "",
  categoryId: "3f2b6c1e-8a4d-4f7e-9b1a-2c5d8e0f1a2b",
  productText: "Assam agarwood chips",
  quantity: "50 kg",
  location: "Dubai",
  notes: "",
  isPublic: false,
  consent: true,
};

describe("postBuyRequirement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyTurnstileMock.mockResolvedValue("passed");
  });

  it("blocks a failed bot check before validating or writing anything", async () => {
    verifyTurnstileMock.mockResolvedValue("failed");

    const result = await postBuyRequirement({ ...validInput, turnstileToken: "forged" });

    expect(result).toMatchObject({ ok: false, code: "bot_check_failed" });
    expect(verifyTurnstileMock).toHaveBeenCalledWith("forged");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("lets the submission through when Cloudflare is unreachable (fails open)", async () => {
    verifyTurnstileMock.mockResolvedValue("unavailable");
    rpcMock.mockResolvedValue({ data: [{ buy_requirement_id: "r1", rate_limited: false }], error: null });

    const result = await postBuyRequirement(validInput);

    expect(rpcMock).toHaveBeenCalledWith("create_buy_requirement", expect.anything());
    expect(result.ok).toBe(true);
  });

  it("maps an unknown category (FK violation) to a categoryId field error, not a server error", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "23503",
        message:
          'insert or update on table "buy_requirements" violates foreign key constraint "buy_requirements_category_id_fkey"',
      },
    });

    const result = await postBuyRequirement(validInput);

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(result.ok === false && result.fieldErrors?.categoryId).toBeTruthy();
  });

  it("still reports any other foreign-key failure as a server error", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "23503", message: 'violates foreign key constraint "buy_requirements_buyer_id_fkey"' },
    });

    const result = await postBuyRequirement(validInput);

    expect(result).toMatchObject({ ok: false, code: "server_error" });
  });

  it("rejects a submission without consent before calling the database", async () => {
    const result = await postBuyRequirement({ ...validInput, consent: false });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(result.ok === false && result.fieldErrors?.consent).toBeTruthy();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

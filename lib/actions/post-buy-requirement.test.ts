import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_NOTICE_VERSION } from "@/lib/consent";

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

  describe("a successful post", () => {
    const originalNumber = process.env.PLATFORM_WHATSAPP_NUMBER;

    beforeEach(() => {
      process.env.PLATFORM_WHATSAPP_NUMBER = "+919577772757";
      rpcMock.mockResolvedValue({ data: [{ buy_requirement_id: "r1", rate_limited: false }], error: null });
    });
    afterEach(() => {
      process.env.PLATFORM_WHATSAPP_NUMBER = originalNumber;
    });

    it("writes through create_buy_requirement with the consent notice version, blanks sent as null", async () => {
      await postBuyRequirement({ ...validInput, isPublic: true });

      expect(rpcMock).toHaveBeenCalledWith("create_buy_requirement", {
        p_phone: "+91 98765 43210",
        p_name: "Asha Buyer",
        p_email: null,
        p_category_id: "3f2b6c1e-8a4d-4f7e-9b1a-2c5d8e0f1a2b",
        p_product_text: "Assam agarwood chips",
        p_quantity: "50 kg",
        p_location: "Dubai",
        p_notes: null,
        p_is_public: true,
        p_consent_notice_version: CONSENT_NOTICE_VERSION,
      });
    });

    it("hands back a wa.me link to the platform number with the requirement prefilled", async () => {
      const result = await postBuyRequirement(validInput);

      expect(result.ok).toBe(true);
      const url = new URL(result.ok ? (result.whatsappUrl ?? "") : "");
      expect(url.origin + url.pathname).toBe("https://wa.me/919577772757");
      expect(url.searchParams.get("text")).toBe(
        "Hi, I just posted a buy requirement on Exporters Assam: Assam agarwood chips (qty: 50 kg) in Dubai.",
      );
    });

    it("leaves the location out of the message when none was given", async () => {
      const result = await postBuyRequirement({ ...validInput, location: "" });

      const text = new URL(result.ok ? (result.whatsappUrl ?? "") : "").searchParams.get("text");
      expect(text).toBe("Hi, I just posted a buy requirement on Exporters Assam: Assam agarwood chips (qty: 50 kg).");
    });

    it("still succeeds, with no WhatsApp link, when no platform number is configured", async () => {
      delete process.env.PLATFORM_WHATSAPP_NUMBER;

      const result = await postBuyRequirement(validInput);

      expect(result).toEqual({ ok: true, whatsappUrl: null });
    });

    it("never puts the buyer's own name, phone or email in the WhatsApp message", async () => {
      const result = await postBuyRequirement({ ...validInput, email: "asha@example.com" });

      const url = result.ok ? (result.whatsappUrl ?? "") : "";
      expect(url).not.toMatch(/Asha|98765|asha%40example/);
    });
  });

  it("reports the hourly cap as rate_limited, not success", async () => {
    rpcMock.mockResolvedValue({ data: [{ buy_requirement_id: null, rate_limited: true }], error: null });

    const result = await postBuyRequirement(validInput);

    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
  });

  it.each([
    ["a database error", { data: null, error: { code: "XX000", message: "boom" } }],
    ["an empty result", { data: [], error: null }],
  ])("reports %s as a server error, and logs it without the buyer's details", async (_label, response) => {
    rpcMock.mockResolvedValue(response);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await postBuyRequirement(validInput);

    expect(result).toMatchObject({ ok: false, code: "server_error" });
    expect(consoleError).toHaveBeenCalled();
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(/Asha|98765/);
    consoleError.mockRestore();
  });

  it.each([
    ["phone", { phone: "12" }],
    ["phone", { phone: "(+) - 12 - ()" }],
    ["productText", { productText: "x" }],
    ["quantity", { quantity: " " }],
    ["email", { email: "not-an-email" }],
    ["name", { name: "A" }],
  ])("returns a %s field error and writes nothing for bad input", async (field, override) => {
    const result = await postBuyRequirement({ ...validInput, ...override });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(result.ok === false && result.fieldErrors?.[field]).toBeTruthy();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

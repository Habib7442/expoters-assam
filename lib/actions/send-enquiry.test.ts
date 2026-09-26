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

import { CONSENT_NOTICE_VERSION } from "@/lib/consent";

import { sendEnquiry, type SendEnquiryInput } from "./send-enquiry";

const PRODUCT_ID = "3f2b6c1e-8a4d-4f7e-9b1a-2c5d8e0f1a2b";
const COMPANY_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const productInput: SendEnquiryInput = {
  targetType: "product",
  productId: PRODUCT_ID,
  productName: "AHI Resin Gold",
  name: "Asha Buyer",
  phone: "+91 98765 43210",
  consent: true,
};

const companyInput: SendEnquiryInput = {
  targetType: "company",
  companyId: COMPANY_ID,
  companyName: "Avadi Herbs India Pvt Ltd",
  name: "Asha Buyer",
  phone: "+91 98765 43210",
  consent: true,
};

function rpcReturnsRow(row: { enquiry_id?: string; rate_limited: boolean; whatsapp_number: string | null }) {
  rpcMock.mockResolvedValue({ data: [{ enquiry_id: "e1", ...row }], error: null });
}

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

describe("sendEnquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyTurnstileMock.mockResolvedValue("passed");
  });

  describe("input validation", () => {
    // covers: AC-2
    it("AC-2: accepts an enquiry with only name and phone filled", async () => {
      rpcReturnsRow({ rate_limited: false, whatsapp_number: null });

      const result = await sendEnquiry(productInput);

      expect(result.ok).toBe(true);
      expect(rpcMock).toHaveBeenCalledTimes(1);
    });

    // covers: AC-2
    it("AC-2: sends null for an empty email and a missing message, not empty strings", async () => {
      rpcReturnsRow({ rate_limited: false, whatsapp_number: null });

      await sendEnquiry({ ...productInput, email: "" });

      expect(rpcMock).toHaveBeenCalledWith("create_enquiry", {
        p_phone: "+91 98765 43210",
        p_name: "Asha Buyer",
        p_email: null,
        p_product_id: PRODUCT_ID,
        p_message: null,
        p_consent_notice_version: CONSENT_NOTICE_VERSION,
      });
    });

    // covers: AC-2
    it("AC-2: rejects a missing name with a name field error and writes nothing", async () => {
      const result = await sendEnquiry({ ...productInput, name: " " });

      expect(result).toMatchObject({ ok: false, code: "invalid_input" });
      expect(result.ok === false && result.fieldErrors?.name).toBeTruthy();
      expect(rpcMock).not.toHaveBeenCalled();
    });

    // covers: AC-2
    it("AC-2: rejects a malformed phone number with the phone field error", async () => {
      const result = await sendEnquiry({ ...productInput, phone: "12345" });

      expect(result).toMatchObject({ ok: false, code: "invalid_input" });
      expect(result.ok === false && result.fieldErrors?.phone).toBe("Enter a valid phone number");
      expect(rpcMock).not.toHaveBeenCalled();
    });

    // covers: AC-2
    it("AC-2: rejects a phone made mostly of symbols, with too few digits, before the database sees it", async () => {
      const result = await sendEnquiry({ ...productInput, phone: "(+) - 12 - ()" });

      expect(result.ok === false && result.fieldErrors?.phone).toBe("Enter a valid phone number");
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("rejects a malformed optional email but accepts a valid one", async () => {
      const bad = await sendEnquiry({ ...productInput, email: "not-an-email" });
      expect(bad.ok === false && bad.fieldErrors?.email).toBe("Enter a valid email address");

      rpcReturnsRow({ rate_limited: false, whatsapp_number: null });
      const good = await sendEnquiry({ ...productInput, email: "asha@example.com" });
      expect(good.ok).toBe(true);
    });

    it("rejects an enquiry without consent before calling the database", async () => {
      const result = await sendEnquiry({ ...productInput, consent: false });

      expect(result).toMatchObject({ ok: false, code: "invalid_input" });
      expect(result.ok === false && result.fieldErrors?.consent).toBeTruthy();
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("rejects a product id that is not a uuid before calling the database", async () => {
      const result = await sendEnquiry({ ...productInput, productId: "1; drop table enquiries" });

      expect(result).toMatchObject({ ok: false, code: "invalid_input" });
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("rejects a message longer than 2000 characters", async () => {
      const result = await sendEnquiry({ ...productInput, message: "a".repeat(2001) });

      expect(result.ok === false && result.fieldErrors?.message).toBeTruthy();
      expect(rpcMock).not.toHaveBeenCalled();
    });
  });

  describe("bot check", () => {
    it("blocks a failed bot check before validating or writing anything", async () => {
      verifyTurnstileMock.mockResolvedValue("failed");

      const result = await sendEnquiry({ ...productInput, turnstileToken: "forged" });

      expect(result).toMatchObject({ ok: false, code: "bot_check_failed" });
      expect(verifyTurnstileMock).toHaveBeenCalledWith("forged");
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("lets the enquiry through when Cloudflare is unreachable (fails open)", async () => {
      verifyTurnstileMock.mockResolvedValue("unavailable");
      rpcReturnsRow({ rate_limited: false, whatsapp_number: null });

      const result = await sendEnquiry(productInput);

      expect(result.ok).toBe(true);
    });
  });

  describe("WhatsApp handoff", () => {
    // covers: AC-3
    it("AC-3: returns a wa.me link to the supplier's number with a readable pre-filled message", async () => {
      rpcReturnsRow({ rate_limited: false, whatsapp_number: "+919577772757" });

      const result = await sendEnquiry(productInput);

      expect(result).toEqual({
        ok: true,
        whatsappUrl: "https://wa.me/919577772757?text=Hi%2C%20I'm%20interested%20in%20AHI%20Resin%20Gold%20on%20Exporters%20Assam.",
      });
    });

    // covers: AC-3
    it("AC-3: appends the buyer's message and url encodes characters that would break the link", async () => {
      rpcReturnsRow({ rate_limited: false, whatsapp_number: "919577772757" });

      const result = await sendEnquiry({ ...productInput, message: "Need 50 kg & a price?" });

      expect(result.ok).toBe(true);
      const url = new URL(result.ok ? (result.whatsappUrl ?? "") : "");
      expect(url.origin + url.pathname).toBe("https://wa.me/919577772757");
      expect(url.searchParams.get("text")).toBe(
        "Hi, I'm interested in AHI Resin Gold on Exporters Assam. Need 50 kg & a price?",
      );
    });

    // covers: AC-4
    it("AC-4: returns success with no WhatsApp link when the company has no contact on file", async () => {
      rpcReturnsRow({ rate_limited: false, whatsapp_number: null });

      const result = await sendEnquiry(productInput);

      expect(result).toEqual({ ok: true, whatsappUrl: null });
    });

    it("writes a company enquiry through create_company_enquiry with company wording in the link", async () => {
      rpcReturnsRow({ rate_limited: false, whatsapp_number: "+919577772757" });

      const result = await sendEnquiry(companyInput);

      expect(rpcMock).toHaveBeenCalledWith(
        "create_company_enquiry",
        expect.objectContaining({ p_company_id: COMPANY_ID }),
      );
      const url = new URL(result.ok ? (result.whatsappUrl ?? "") : "");
      expect(url.searchParams.get("text")).toBe(
        "Hi, I'm interested in working with Avadi Herbs India Pvt Ltd on Exporters Assam.",
      );
    });
  });

  describe("database outcomes", () => {
    // covers: AC-5 (the cap itself is enforced in create_enquiry; this pins the action's mapping)
    it("AC-5: reports a rate limited enquiry with a clear message and no link", async () => {
      rpcReturnsRow({ rate_limited: true, whatsapp_number: "+919577772757" });

      const result = await sendEnquiry(productInput);

      expect(result).toMatchObject({ ok: false, code: "rate_limited" });
      expect(result.ok === false && result.message).toMatch(/several enquiries recently/);
    });

    // covers: AC-5 (a duplicate inside the 10 minute window comes back as a normal row, so the buyer still sees success)
    it("AC-5: treats a deduplicated enquiry as a normal success", async () => {
      rpcReturnsRow({ enquiry_id: "existing-enquiry", rate_limited: false, whatsapp_number: "+919577772757" });

      const result = await sendEnquiry(productInput);

      expect(result.ok).toBe(true);
    });

    // covers: AC-8
    it("AC-8: maps product_not_found (P0002) to a not_found result, not a server error", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { code: "P0002", message: "product_not_found" } });

      const result = await sendEnquiry(productInput);

      expect(result).toEqual({ ok: false, code: "not_found", message: "This product is no longer available." });
    });

    it("maps P0002 on a company enquiry to the company wording", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { code: "P0002", message: "company_not_found" } });

      const result = await sendEnquiry(companyInput);

      expect(result).toMatchObject({ ok: false, code: "not_found", message: "This company is no longer available." });
    });

    it("reports any other database error as a generic server error without leaking its details", async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { code: "42501", message: "permission denied for table company_contacts" },
      });

      const result = await sendEnquiry(productInput);

      expect(result).toMatchObject({ ok: false, code: "server_error" });
      expect(JSON.stringify(result)).not.toContain("company_contacts");
    });

    it("reports a server error when the database returns no row", async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });

      const result = await sendEnquiry(productInput);

      expect(result).toMatchObject({ ok: false, code: "server_error" });
    });

    // covers: review finding, a lost lead must leave a trace in the server logs
    it("logs a database failure with its code, without any buyer details", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { code: "57014", message: "canceling statement due to timeout" } });

      await sendEnquiry({ ...productInput, email: "asha@example.com", message: "private note" });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logged = JSON.stringify(consoleErrorSpy.mock.calls[0]);
      expect(logged).toContain("57014");
      for (const pii of ["Asha Buyer", "98765", "asha@example.com", "private note"]) {
        expect(logged).not.toContain(pii);
      }
    });

    it("logs when the database returns no row", async () => {
      rpcMock.mockResolvedValue({ data: [], error: null });

      await sendEnquiry(productInput);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("does not log an expected outcome like not found or a rate limit", async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "product_not_found" } });
      await sendEnquiry(productInput);
      rpcReturnsRow({ rate_limited: true, whatsapp_number: null });
      await sendEnquiry(productInput);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});

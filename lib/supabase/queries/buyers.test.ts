import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { getOrCreateBuyerByPhone } from "./buyers";

describe("getOrCreateBuyerByPhone", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns the buyer id from the get_or_create_buyer RPC result", async () => {
    rpcMock.mockResolvedValue({ data: { id: "buyer-1" }, error: null });

    await expect(
      getOrCreateBuyerByPhone("+919876543210", "Asha", "asha@example.com"),
    ).resolves.toBe("buyer-1");
  });

  it("calls get_or_create_buyer with the phone, name, and email", async () => {
    rpcMock.mockResolvedValue({ data: { id: "buyer-1" }, error: null });

    await getOrCreateBuyerByPhone("+919876543210", "Asha", "asha@example.com");

    expect(rpcMock).toHaveBeenCalledWith("get_or_create_buyer", {
      p_phone: "+919876543210",
      p_name: "Asha",
      p_email: "asha@example.com",
    });
  });

  it("omits the email when the caller does not provide one", async () => {
    rpcMock.mockResolvedValue({ data: { id: "buyer-2" }, error: null });

    await getOrCreateBuyerByPhone("+919876543211", "Ravi");

    expect(rpcMock).toHaveBeenCalledWith("get_or_create_buyer", {
      p_phone: "+919876543211",
      p_name: "Ravi",
      p_email: undefined,
    });
  });

  it("normalizes a null email to undefined rather than passing null through", async () => {
    rpcMock.mockResolvedValue({ data: { id: "buyer-3" }, error: null });

    await getOrCreateBuyerByPhone("+919876543212", "Deepa", null);

    expect(rpcMock).toHaveBeenCalledWith("get_or_create_buyer", {
      p_phone: "+919876543212",
      p_name: "Deepa",
      p_email: undefined,
    });
  });

  it("throws when the RPC call errors, instead of returning a partial result", async () => {
    const dbError = new Error("unique_violation");
    rpcMock.mockResolvedValue({ data: null, error: dbError });

    await expect(getOrCreateBuyerByPhone("+919876543210", "Asha")).rejects.toBe(dbError);
  });
});

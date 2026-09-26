import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const verifyWebhookMock = vi.fn();
vi.mock("@clerk/nextjs/webhooks", () => ({
  verifyWebhook: (...args: unknown[]) => verifyWebhookMock(...args),
}));

const deleteSupplierDataMock = vi.fn();
vi.mock("@/lib/supplier-deletion", () => ({
  deleteSupplierData: (...args: unknown[]) => deleteSupplierDataMock(...args),
}));

import { POST } from "./route";

const request = {} as NextRequest;

describe("POST /api/webhooks/clerk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    deleteSupplierDataMock.mockResolvedValue({ companyDeleted: true, imagesDeleted: 2 });
  });

  it("rejects an unsigned or forged request with 400, deleting nothing", async () => {
    verifyWebhookMock.mockRejectedValue(new Error("bad signature"));

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(deleteSupplierDataMock).not.toHaveBeenCalled();
  });

  it("deletes the supplier's data on user.deleted", async () => {
    verifyWebhookMock.mockResolvedValue({ type: "user.deleted", data: { id: "user_1", deleted: true } });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(deleteSupplierDataMock).toHaveBeenCalledWith("user_1");
  });

  it("answers 500 when the deletion fails, so Clerk retries it", async () => {
    verifyWebhookMock.mockResolvedValue({ type: "user.deleted", data: { id: "user_1", deleted: true } });
    deleteSupplierDataMock.mockRejectedValue(new Error("db down"));

    const response = await POST(request);

    expect(response.status).toBe(500);
  });

  it.each(["user.created", "user.updated", "session.created"])("acknowledges %s without deleting anything", async (type) => {
    verifyWebhookMock.mockResolvedValue({ type, data: { id: "user_1" } });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(deleteSupplierDataMock).not.toHaveBeenCalled();
  });
});

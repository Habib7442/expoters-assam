import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { assertOwnsCompany } from "./assert-company-owner";

function mockOwnershipQuery(result: { data: { id: string } | null; error: Error | null }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  const eqMock = vi.fn(() => builder);
  builder.eq = eqMock;
  builder.maybeSingle = vi.fn(async () => result);
  fromMock.mockReturnValue(builder);
  return { eqMock };
}

describe("assertOwnsCompany", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("resolves without throwing when the Clerk user owns the company", async () => {
    mockOwnershipQuery({ data: { id: "company-1" }, error: null });

    await expect(assertOwnsCompany("user_1", "company-1")).resolves.toBeUndefined();
  });

  it("filters the companies table by both id and clerk_user_id", async () => {
    const { eqMock } = mockOwnershipQuery({ data: { id: "company-1" }, error: null });

    await assertOwnsCompany("user_1", "company-1");

    expect(fromMock).toHaveBeenCalledWith("companies");
    expect(eqMock).toHaveBeenNthCalledWith(1, "id", "company-1");
    expect(eqMock).toHaveBeenNthCalledWith(2, "clerk_user_id", "user_1");
  });

  it("throws when no row matches (the Clerk user does not own this company)", async () => {
    mockOwnershipQuery({ data: null, error: null });

    await expect(assertOwnsCompany("user_1", "someone-elses-company")).rejects.toThrow(
      /does not own company/,
    );
  });

  it("propagates the underlying database error instead of swallowing it", async () => {
    const dbError = new Error("connection reset");
    mockOwnershipQuery({ data: null, error: dbError });

    await expect(assertOwnsCompany("user_1", "company-1")).rejects.toBe(dbError);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { getCurrentTier, getCurrentTiersFor } from "./company-tiers";

/**
 * A chainable query builder stub. `.select`/`.eq`/`.in` return itself; the
 * chain is awaitable directly (for the `.in()` batch query, which the source
 * awaits without a terminal `.maybeSingle()`) and `.maybeSingle()` also
 * resolves to the same result, matching how supabase-js's builders behave.
 */
function builderResolvingTo(result: { data: unknown; error: Error | null }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (onFulfilled: (v: unknown) => void) => onFulfilled(result);
  return builder;
}

describe("getCurrentTier", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns the tier read through the company_tiers view", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: { tier: "gold" }, error: null }));

    await expect(getCurrentTier("company-1")).resolves.toBe("gold");
  });

  it("queries the company_tiers view filtered by company_id", async () => {
    const builder = builderResolvingTo({ data: { tier: "gold" }, error: null });
    fromMock.mockReturnValue(builder);

    await getCurrentTier("company-1");

    expect(fromMock).toHaveBeenCalledWith("company_tiers");
    expect(builder.eq).toHaveBeenCalledWith("company_id", "company-1");
  });

  it("defaults to basic when the company has no row in the view", async () => {
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error: null }));

    await expect(getCurrentTier("company-2")).resolves.toBe("basic");
  });

  it("throws when the query errors, instead of silently defaulting", async () => {
    const dbError = new Error("network error");
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error: dbError }));

    await expect(getCurrentTier("company-1")).rejects.toBe(dbError);
  });
});

describe("getCurrentTiersFor", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns an empty object without querying when given no company ids", async () => {
    const result = await getCurrentTiersFor([]);

    expect(result).toEqual({});
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("defaults every requested company to basic, then applies the tiers found", async () => {
    fromMock.mockReturnValue(
      builderResolvingTo({
        data: [{ company_id: "company-1", tier: "silver" }],
        error: null,
      }),
    );

    const result = await getCurrentTiersFor(["company-1", "company-2"]);

    expect(result).toEqual({ "company-1": "silver", "company-2": "basic" });
  });

  it("queries the company_tiers view filtered by the given company ids", async () => {
    const builder = builderResolvingTo({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await getCurrentTiersFor(["company-1", "company-2"]);

    expect(fromMock).toHaveBeenCalledWith("company_tiers");
    expect(builder.in).toHaveBeenCalledWith("company_id", ["company-1", "company-2"]);
  });

  it("throws when the batch query errors, instead of returning partial defaults", async () => {
    const dbError = new Error("timeout");
    fromMock.mockReturnValue(builderResolvingTo({ data: null, error: dbError }));

    await expect(getCurrentTiersFor(["company-1"])).rejects.toBe(dbError);
  });
});

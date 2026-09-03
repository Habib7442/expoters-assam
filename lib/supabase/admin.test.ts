import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn<(...args: unknown[]) => { __brand: string }>(() => ({
  __brand: "supabase-admin-client",
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const ORIGINAL_ENV = { ...process.env };

describe("lib/supabase/admin", () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("creates the client with the secret key, never the publishable key", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_value";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_value";

    await import("./admin");

    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, key] = createClientMock.mock.calls[0]!;
    expect(url).toBe("https://project.supabase.co");
    expect(key).toBe("sb_secret_value");
    expect(key).not.toBe("sb_publishable_value");
  });
});

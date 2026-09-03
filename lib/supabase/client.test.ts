import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn<(...args: unknown[]) => { __brand: string }>(() => ({
  __brand: "supabase-public-client",
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const ORIGINAL_ENV = { ...process.env };

describe("lib/supabase/client", () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("creates the client with the publishable key, never the secret key", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_value";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_value";

    await import("./client");

    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, key] = createClientMock.mock.calls[0]!;
    expect(url).toBe("https://project.supabase.co");
    expect(key).toBe("sb_publishable_value");
    expect(key).not.toBe("sb_secret_value");
  });
});

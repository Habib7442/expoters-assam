import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readTurnstileToken, verifyTurnstile } from "./turnstile";

const fetchMock = vi.fn();

describe("verifyTurnstile", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("passes when Cloudflare confirms the token", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    expect(await verifyTurnstile("token")).toBe("passed");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(String(init.body)).toContain("secret=test-secret");
    expect(String(init.body)).toContain("response=token");
  });

  it("fails when Cloudflare rejects the token", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] })));
    expect(await verifyTurnstile("forged")).toBe("failed");
  });

  it("fails without calling Cloudflare when there is no token", async () => {
    expect(await verifyTurnstile(undefined)).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is unavailable (fails open) when Cloudflare errors or is unreachable", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 503 }));
    expect(await verifyTurnstile("token")).toBe("unavailable");

    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    expect(await verifyTurnstile("token")).toBe("unavailable");
  });

  it("is not_configured, and never calls Cloudflare, when the secret is missing", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(await verifyTurnstile("token")).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("readTurnstileToken", () => {
  it("accepts only a non-empty, bounded string", () => {
    expect(readTurnstileToken("abc")).toBe("abc");
    expect(readTurnstileToken("")).toBeUndefined();
    expect(readTurnstileToken(42)).toBeUndefined();
    expect(readTurnstileToken({ token: "x" })).toBeUndefined();
    expect(readTurnstileToken("x".repeat(2049))).toBeUndefined();
  });
});

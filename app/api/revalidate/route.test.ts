import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { POST } from "./route";

const call = (authorization?: string) =>
  POST(
    new Request("https://www.exportersassam.com/api/revalidate", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }) as never,
  );

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("REVALIDATE_SECRET", "s3cret-value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refreshes the home page, every product and company page, and the sitemap with the right secret", async () => {
    const response = await call("Bearer s3cret-value");

    expect(response.status).toBe(200);
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/products/[slug]", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/companies/[slug]", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/sitemap.xml");
  });

  it("refuses a wrong or missing secret and refreshes nothing", async () => {
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call()).status).toBe(401);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("stays off when no secret is configured", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");

    expect((await call("Bearer ")).status).toBe(503);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

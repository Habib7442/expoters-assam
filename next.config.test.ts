import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("next.config.ts images.remotePatterns (spec 0004 AC-3)", () => {
  // The R2 hostname must be a literal here, not read from process.env: this
  // file is evaluated at build time, and a Vercel deploy that only sets
  // R2_PUBLIC_IMAGE_DOMAIN as a runtime var would otherwise silently produce
  // hostname: undefined and break every image in production.
  it("allows the R2 public image domain so next/image never reports an unconfigured host", () => {
    const patterns = nextConfig.images?.remotePatterns ?? [];
    const r2Pattern = patterns.find(
      (pattern) => "hostname" in pattern && pattern.hostname === "images.exportersasssm.com",
    );

    expect(r2Pattern).toBeDefined();
    expect(r2Pattern).toMatchObject({ protocol: "https", pathname: "/**" });
  });
});

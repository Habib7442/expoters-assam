import type { NextConfig } from "next";

// Baseline security headers on every response. Deliberately no full
// Content-Security-Policy yet: Clerk loads scripts, styles, and frames from
// its own domains (and Razorpay will add more), so a script-src policy needs
// its own tested rollout. `frame-ancestors` is the one CSP directive that is
// safe to ship now — it only controls who may frame *this* site.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  experimental: {
    serverActions: {
      // Under Vercel's 4.5 MB request cap. Product photos are shrunk in the
      // browser first (lib/shrink-image.ts) so five of them fit.
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        // A literal, not read from R2_PUBLIC_IMAGE_DOMAIN: next.config.ts
        // is evaluated at build time, and a Vercel deploy that only sets
        // this as a runtime var would otherwise silently produce
        // hostname: undefined and break every image in production.
        hostname: "images.exportersasssm.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

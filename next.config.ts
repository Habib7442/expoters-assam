import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
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

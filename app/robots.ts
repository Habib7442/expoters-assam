import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

// Only the API is blocked. The per-user pages (sign in, sign up, list your
// business, add a product) are deliberately NOT listed: they carry noindex
// metadata, and a crawler can only see noindex on a page it may fetch. A
// robots-blocked URL that other pages link to (the header links to sign in
// and list your business everywhere) can still show up in results as a bare
// URL.
const PRIVATE_PATHS = ["/api/"];

/**
 * Search engines and AI answer engines (ChatGPT, Claude, Perplexity, Google
 * AI Overviews) are all welcome: for a directory, being cited as the source
 * for "who exports agarwood from Assam" is the point.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}

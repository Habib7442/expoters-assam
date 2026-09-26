import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

// Private or per-user pages, and the API. They also carry noindex metadata;
// this keeps crawlers from spending their budget on them at all.
const PRIVATE_PATHS = ["/api/", "/list-business", "/products/new", "/sign-in", "/sign-up"];

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

/**
 * The live site's canonical origin (with www), locked 2026-09-26. Used for
 * metadataBase, canonical URLs, the sitemap, robots.txt and structured data,
 * so every absolute URL the site publishes points at the same host.
 */
export const SITE_URL = "https://www.exportersasssm.com";

export const SITE_NAME = "Exporters Assam";

/** The operating company, as named in the Terms and Privacy Policy. */
export const OPERATOR_NAME = "Avadi Herbs India Pvt. Ltd.";

export const CONTACT_EMAIL = "info@exportsassam.com";

/** An absolute URL on the live site for a path like "/products/tea". */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

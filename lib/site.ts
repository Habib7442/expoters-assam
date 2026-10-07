/**
 * The live site's canonical origin (with www); moved 2026-09-28 from the old
 * www.exportersasssm.com. Used for metadataBase, canonical URLs, the
 * sitemap, robots.txt and structured data, so every absolute URL the site
 * publishes points at the same host. Images stay on their own R2 domain,
 * images.exportersasssm.com (spec 0004), which this does not change.
 */
export const SITE_URL = "https://www.exportersassam.com";

export const SITE_NAME = "Exporters Assam";

/** The operating company, as named in the Terms and Privacy Policy. */
export const OPERATOR_NAME = "Avadi Herbs India Pvt. Ltd.";

export const CONTACT_EMAIL = "avadiherbsindia@gmail.com";

/**
 * The site-wide social preview image. A page that sets its own
 * `openGraph` replaces the layout's whole object (Next doesn't merge it),
 * so pages must fall back to this explicitly when they have no image.
 */
export const DEFAULT_OG_IMAGE = { url: "/og_image.png", width: 1731, height: 909, alt: SITE_NAME };

/** An absolute URL on the live site for a path like "/products/tea". */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

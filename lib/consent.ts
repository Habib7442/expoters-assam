/**
 * The Privacy Policy version a user consents to on the storefront's forms,
 * stored with each enquiry, buy requirement, and business listing as proof
 * of consent (DPDP Act s. 6(10)). Bump it to the new "Last updated" date
 * whenever app/privacy/page.tsx changes materially.
 */
// 2026-10-07: public buy requirements can be unlocked by suppliers (spec
// 0009). The database gates unlocking on this version, so it must stay at
// or after "2026-10-07" (see contact_unlockable).
export const CONSENT_NOTICE_VERSION = "2026-10-07";

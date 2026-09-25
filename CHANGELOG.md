# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added the core Supabase data layer: the `companies`, `products`, `categories`, `buyers`, `buy_requirements`, `enquiries`, and `memberships` tables, plus two read-only views (`company_tiers`, `directory_stats`) that expose derived facts (a company's current membership tier, directory-wide counts) without opening the underlying tables to public reads (spec 0001).
- Added Row Level Security to every table: the public role can read only approved companies/products, all categories, and public buy requirements; every other read and every write is blocked, enforced by RLS plus an explicit privilege revoke, not by application code.
- Added the `product-images` and `company-logos` Storage buckets, publicly readable, writable only through server routes.
- Added the server-side access-control helpers this project's write model relies on: `assertOwnsCompany` (ownership check before a mutating route touches a company/product), `getCurrentTier`/`getCurrentTiersFor` (a company's membership tier, always read through `company_tiers`, never a stored column), and `getOrCreateBuyerByPhone` (looks up or creates a buyer by normalized phone, reusing the same row across repeat submissions without duplicating a buyer on concurrent inserts).
- Added a Vitest test suite (19 tests) covering the client/query helper layer, including a regression guard that the admin Supabase client only ever wires the secret key and the public client only the publishable key.
- Added product pages at `/products/[slug]`: name, images, description, category badge, and a company card (logo or initial, location, Verified badge, Silver/Gold member badge). A missing product, or a product whose company is not approved yet, shows the 404 page. Each product gets a unique, URL safe slug at creation; a rename never changes it (spec 0003).
- Added the Send Enquiry dialog on product pages. A buyer gives a name and phone (email and message optional); the enquiry is saved in `enquiries`, and when the supplier has a WhatsApp number on file the buyer gets a "Continue on WhatsApp" link (`wa.me`) with a pre-filled message naming the product. No WhatsApp API is called; the buyer opens the chat themselves. Without a number on file, the buyer sees a plain confirmation instead (spec 0003).
- Added limits on enquiries, enforced in the database: the same phone sending the same product again within 10 minutes is treated as one enquiry (no duplicate row), and a phone is capped at 5 enquiries an hour, with a clear message when it hits the cap. Concurrent submissions from one buyer are serialized, so a burst cannot slip past the cap (spec 0003).
- Added the `company_contacts` table, which holds each supplier's WhatsApp number. It is never readable by the public role; only the server side enquiry function reads it (spec 0003).
- Added a demo seed script (`npm run seed:demo`) that creates one approved company, contact, category, and product so the product page has real data to render in development.
- Added tests for the enquiry action, the product query, and the product page (38 tests), each traced to spec 0003's acceptance criteria.

### Fixed
- Fixed the Send Enquiry dialog wiping everything the buyer typed whenever a submission was rejected (a mistyped phone, a failed bot check, the rate limit); the form now keeps its values until the enquiry succeeds.
- Fixed failed enquiry writes leaving no trace: a database error while saving an enquiry is now logged on the server (error code and message only, never the buyer's details), so a lost lead can be investigated.
- Fixed buyer phone numbers typed with a leading `0` (the common Indian STD-prefixed form) or the international `00` dialing prefix being rejected outright instead of normalized, which previously failed the enquiry or buy-requirement submission that triggered it.

### Security
- Hardened the database privilege model so a table added by a future migration no longer inherits public write access by default; previously only tables that existed at the time of the initial migration were covered by the explicit privilege revoke.

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
- Added company profile pages at `/companies/[slug]`: logo (or the name's first letter), about text, location, product count, "Member since" year, Verified badge, Silver/Gold member badge, a grid of the company's approved products (newest first), and a Send Enquiry button aimed at the company. A company with no products yet gets an empty state with its own enquiry button. A missing or not yet approved company shows the 404 page. Home page exporter cards and the company block on product pages now link here.
- Added a unique, URL safe `slug` to every company. Existing companies were backfilled without collisions, a new business listing gets its slug when it is created (a numeric suffix if the name is taken), and a rename never changes it.
- Added tests for the company query helpers, the company profile page and its metadata, and the exporter card (43 tests).
- Added tests for the home page and its query helpers (40 tests), including proof that one failing section never breaks the rest of the page (spec 0002).
- Added tests for Post Buy Requirement: the full success path (database call, consent version, WhatsApp link to the platform number), the hourly cap, bad input, server errors, and the `/buy-requirements` listing page.

### Changed
- The company profile query now filters for approved companies and approved products explicitly, as a second layer on top of Row Level Security, matching every other public read path.
- The header now uses the design system colors throughout, replacing the default Tailwind palette in the mobile menu.
- Rewrote the `/buy-requirements` page copy to match how the platform actually works: the team matches each requirement with exporters and introduces them on WhatsApp. Removed claims the product doesn't keep (direct supplier quotes, lab test reports, certified producers, instant replies). The list is now labeled "Recent Requirements" and says when it is showing only the newest 100.

### Removed
- Removed two plain indexes on `companies.slug` and `products.slug` that duplicated the unique index each table already has, cutting write and storage cost with no effect on lookups.
- Removed the home page stats strip (verified exporters, products, buyers, countries) and its query; with launch numbers this small it made the directory look empty (spec 0002, AC-9 dropped).

### Fixed
- Fixed the Send Enquiry dialog wiping everything the buyer typed whenever a submission was rejected (a mistyped phone, a failed bot check, the rate limit); the form now keeps its values until the enquiry succeeds.
- Fixed failed enquiry writes leaving no trace: a database error while saving an enquiry is now logged on the server (error code and message only, never the buyer's details), so a lost lead can be investigated.
- Fixed buyer phone numbers typed with a leading `0` (the common Indian STD-prefixed form) or the international `00` dialing prefix being rejected outright instead of normalized, which previously failed the enquiry or buy-requirement submission that triggered it.
- Fixed Featured Products on the home page showing fewer than 8 cards when some products had images outside the image host; the image check now happens in the query, before the limit (spec 0002).
- Fixed home page category tiles counting products from approved but unverified companies, so a tile could promise more products than the category page it links to shows.
- Fixed buy requirement dates following the server clock (UTC on Vercel); a requirement posted just after midnight in India now shows that day, not the day before.
- Fixed the home page showing made up category names when categories failed to load; the chip row is now left out like every other section, and each chip links to its category.
- Fixed phone numbers made mostly of symbols (fewer than 10 digits) passing the form check on Send Enquiry and Post Buy Requirement and then failing in the database as a generic error; they now get a clear phone field error.
- Fixed failed buy requirement saves leaving no trace; the error is now logged on the server (code and message only, never the buyer's details).

### Security
- Hardened the database privilege model so a table added by a future migration no longer inherits public write access by default; previously only tables that existed at the time of the initial migration were covered by the explicit privilege revoke.

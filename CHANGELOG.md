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

### Fixed
- Fixed buyer phone numbers typed with a leading `0` (the common Indian STD-prefixed form) or the international `00` dialing prefix being rejected outright instead of normalized, which previously failed the enquiry or buy-requirement submission that triggered it.

### Security
- Hardened the database privilege model so a table added by a future migration no longer inherits public write access by default; previously only tables that existed at the time of the initial migration were covered by the explicit privilege revoke.

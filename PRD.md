# Product Requirements Document — ExportsAssam.com

**B2B Trade Directory & Enquiry Platform**

| Detail | Information |
|---|---|
| Prepared for | Avadi Herbs India Pvt. Ltd. (GST 18AAUCA6134A1ZQ) |
| Prepared by | Locallify Agency (locallifyagency.com) |
| Domain | exportersassam.com |
| Document version | 2.0 |
| Date | 14 August 2026 |
| Status | For client review & approval |

---

## Contents

1. Project Overview
2. Goals of the Website
3. Who Will Use the Website
4. Core Features & Sections
5. How Enquiries Work (No Online Payments)
6. Membership Plans (Paid via Razorpay)
7. Search System
8. SEO — Getting Found on Google
9. GEO — Getting Found on AI Assistants
10. Technology Stack
11. Design & Look
12. What We Need From You
13. Project Timeline
14. Maintenance & Support
15. What Is Not Included
16. Assumptions
17. Next Steps

---

## 1. Project Overview

This document explains, in simple terms, the website we will build for **Avadi Herbs India Pvt. Ltd.** on your own domain, **exportersassam.com**. It describes what the website will do, who will use it, how it will look, and how the whole project will be delivered. Please read it and share any changes — nothing is final until you approve it.

exportersassam.com will be a **B2B (business-to-business) trade directory** — a place that connects manufacturers, exporters, suppliers and buyers from Assam and across India, in the same style as IndiaMART. Businesses list what they make or sell, buyers post what they want to purchase, and the two sides connect with each other.

**One important point:** this is a **directory and enquiry platform, not an online shop.** Buyers and sellers do not transact through the website — there is no cart and no product checkout. Every product enquiry is captured and sent straight to your WhatsApp so your team can respond and close the deal personally, exactly the way IndiaMART works.

The **one paid feature** on the site is **membership** (see Section 6). Suppliers who want more visibility can upgrade to Silver or Gold and pay online through **Razorpay**. Nothing else on the site involves online payment.

---

## 2. Goals of the Website

- **Global reach:** Give Avadi Herbs and other Assam businesses a professional online presence that reaches buyers across India and abroad.
- **Easy discovery:** Let buyers find products (agarwood inoculation products, nursery live plants, spices and more) and contact suppliers easily.
- **Lead generation:** Turn website visitors into real enquiries that land in your WhatsApp, so no lead is lost.
- **Membership revenue:** Give suppliers a reason to pay — better visibility, a verified badge and priority — collected online through Razorpay.
- **Trust & branding:** Show your business as verified and trustworthy, with a clean, premium look.
- **Be found:** Rank well on Google and be visible on modern AI assistants like ChatGPT and Gemini.

---

## 3. Who Will Use the Website

The website is built around four types of people:

| User | What they do |
|---|---|
| **Buyers** | Search products, browse suppliers, and send enquiries or post what they want to buy. |
| **Suppliers / Exporters** | Create a company profile, list their products, receive buyer enquiries, and optionally pay for a membership upgrade. |
| **Visitors** | Anyone browsing the site who has not identified themselves yet; encouraged to register or enquire. |
| **Admin (You / Locallify)** | Manage all listings, companies, categories, memberships and enquiries from a private dashboard. |

> **Buyers vs Visitors:** every buyer starts as a visitor. A *visitor* is anonymous — just browsing. The moment they act (send an enquiry or post a buy requirement), they become a *buyer* — an identified lead saved to the database and sent to your WhatsApp.

---

## 4. Core Features & Sections

Below are the main parts of the website. This is the full scope of what will be built.

### Home Page
- A large banner (hero) with your headline, search bar and key highlights.
- Quick stats (verified exporters, products, buyers, countries connected).
- Featured products, popular categories, featured exporters and latest buy requirements.
- "List Your Business Free" and "Post Buy Requirement" action buttons.

### Product & Company Listings
- Each product has its own page: name, images, description, category and the supplier behind it.
- Each company has its own profile page: logo, about, location, product range and a verified badge.
- Products are organised into categories (Agarwood & Oud, Spices & Herbs, Tea, Essential Oils, Nursery Plants, and more).
- **Two ways products get added:** you (admin) add products directly, or a supplier adds their own products from their supplier dashboard. Either way, a product a supplier submits stays **pending** and is not shown publicly until you **approve** it from the Admin Dashboard. Products you (admin) add yourself go live immediately, no approval step needed.

### Categories & Country Filters
- Browse by product category or by supplier location / country, just like the reference site.

### Post Buy Requirement
- A buyer fills a short form saying what they want (product, quantity, location, notes).
- The requirement is saved and can appear publicly under "Latest Buy Requirements", so relevant suppliers can respond.
- You receive the requirement instantly on WhatsApp.

### Enquiry System
- "Send Enquiry" buttons on products, companies and requirements.
- Every enquiry is saved to the database and forwarded to your WhatsApp — see Section 5.

### Membership Plans (Paid)
- Three levels — **Basic, Silver and Gold** — that control how much visibility a business gets. Upgrades are paid online through Razorpay. See Section 6.

### AI-Powered Search
- A smart search bar that understands what people type, handles spelling mistakes, and shows results as they type. See Section 7.

### Admin Dashboard
- A private, password-protected area for you to add / edit / remove products, companies, categories and members, view all enquiries, and see membership payments in one place.
- **Approval queue:** every product a supplier submits themselves lands here first; you approve or reject it before it appears on the live site.

---

## 5. How Enquiries Work (No Online Payments)

This is the heart of the platform, so we want it to be crystal clear. **Buyer–seller enquiries never involve online payment.** Instead, every action that shows interest is captured and sent to you to handle personally.

Whenever someone sends an enquiry, posts a buy requirement, or contacts a supplier:

1. **Step 1** — Their details are securely saved in the database (Supabase).
2. **Step 2** — A message is instantly sent to your WhatsApp with all the details.
3. **Step 3** — Your team replies on WhatsApp and closes the deal in your own way — product pricing and payment happen offline, off the website.

**Why this is good for you:** no product-transaction fees, no commissions, no legal burden of handling buyers' money online, and you stay in full control of every deal — while still capturing every lead automatically.

> The single exception is **membership**, which *is* paid online via Razorpay (Section 6). That is a payment from a supplier to you, not a buyer-to-seller product transaction.

---

## 6. Membership Plans (Paid via Razorpay)

Membership decides how visible a business is on the platform, and it is how the directory earns for you. Suppliers upgrade themselves and **pay online through Razorpay** — no manual chasing required.

**How a supplier buys membership:**

1. On their dashboard, the supplier chooses a plan (Silver or Gold).
2. They pay securely through **Razorpay** (UPI, cards, netbanking, wallets).
3. On successful payment, their account is **upgraded automatically** — badge, ranking boost and featured placement switch on instantly.
4. You can also upgrade, downgrade or extend any member manually from the admin dashboard, and every payment is logged for your records.

Here is a suggested structure. Please adjust the limits, benefits and prices as you like.

| Feature | Basic | Silver | Gold |
|---|---|---|---|
| Company profile | Yes | Yes | Yes |
| Products you can list | Up to 5 | Up to 25 | Unlimited |
| Verified badge | No | Yes | Yes |
| Search placement | Normal | Higher | Top priority |
| Featured on home page | No | Sometimes | Yes |
| Receive buyer enquiries | Yes | Yes | Priority |
| Price | Free | *to be decided* | *to be decided* |

> **Note:** the limits and prices above are a starting point for discussion, not final. Please confirm what each tier should include and cost.

**A realistic expectation:** membership tiers only *mean* something once there are enough suppliers competing for attention. At launch, with a small number of listings, "top placement" and "featured" have little effect. Their value grows as the directory fills up — so it is best seen as a revenue feature that strengthens over time.

---

## 7. Search System

You mentioned a few AI search tools (Algolia, Kapa.ai, Inkeep, Cloudflare AI Search). Here is an honest recommendation so your money goes to the right place.

Two of those tools — **Kapa.ai** and **Inkeep** — are actually built to answer support questions from a company's help documents (like a customer-support chatbot). They are enterprise-priced and are not designed for searching a product directory, so they are **not the right fit** here.

For a directory like exportersassam.com, what you actually need is **fast product search** with filters, spelling tolerance, and instant suggestions as the user types. We recommend building this directly into your database (**Supabase**), including a modern "semantic" search that understands meaning, not just exact words. This gives you a genuinely AI-powered search experience with **no extra monthly software bills.**

> **Recommendation:** built-in Supabase search (with AI/semantic matching). If in future you want the polished "as-you-type" experience of Algolia, it can be added later — Algolia has a free tier, with paid plans as the site grows. That cost, if you choose it, would be billed to you directly.

---

## 8. SEO — Getting Found on Google

SEO (Search Engine Optimization) means making sure people find you on Google when they search for your products. The website will include:

- **Sitemap:** so Google can discover every page.
- **Tags & titles:** proper titles, tags and descriptions on every product and company page.
- **Structured data:** so products, prices and reviews can show richly in Google results.
- **Clean URLs & speed:** keyword-friendly web addresses and fast page loading.
- **Mobile-first:** mobile-friendly design, which Google rewards.

---

## 9. GEO — Getting Found on AI Assistants

GEO (Generative Engine Optimization) is the newer companion to SEO. More and more buyers now ask AI assistants like ChatGPT, Google Gemini and Perplexity for recommendations instead of using a normal search engine. GEO means preparing your website so these AI tools can read it and recommend your business.

- **AI-readable content:** clear, well-structured content that AI systems can understand and quote.
- **Structured facts:** machine-readable data about your products and company.
- **Crawler access:** settings that allow trusted AI crawlers to index your site (while blocking bad bots).

Together, SEO + GEO mean your business can be found both the traditional way (Google) and the modern way (AI assistants).

---

## 10. Technology Stack

These are the tools we will use to build your website. All are modern, reliable and used by top companies worldwide. (Branded logos for each will appear in the final visual proposal.)

| Technology | What it does, in plain words |
|---|---|
| **Next.js (React)** | The main framework — builds a fast, modern, mobile-friendly website that is also great for SEO. |
| **Supabase** | Your secure cloud database — stores all products, companies, users, memberships and enquiries. No server for you to manage. |
| **Tailwind CSS** | The styling tool that gives the site a clean, premium, consistent look. |
| **Razorpay** | The payment gateway used for membership upgrades (UPI, cards, netbanking, wallets). |
| **WhatsApp Integration** | Sends every enquiry straight to your WhatsApp automatically. |
| **Vercel** | The hosting platform that keeps the website online, fast and secure worldwide. |
| **Semantic / AI Search** | Smart search built into Supabase so buyers find the right product quickly. |
| **PostHog** | Product analytics — shows how visitors actually use the site (page views, search behaviour, enquiry funnel drop-off), so decisions about what to improve are based on real data. |

> **Possible future addition — Sanity:** if you later want a blog or articles section (buying guides, category write-ups) to support the SEO/GEO goals in Sections 8–9, **Sanity** is a good fit as a content editor for that kind of material. It is not part of the current scope, since Section 10's data (products, companies, memberships, enquiries) is already fully covered by Supabase.

---

## 11. Design & Look

- **Theme:** a premium black theme, as you requested, paired with your brand green for a clean, trustworthy feel.
- **Branding:** your logo and provided HD images used prominently.
- **Responsive:** fully responsive — looks great on mobile, tablet and desktop.
- **Easy to use:** simple, uncluttered layout modelled on IndiaMART so buyers instantly know how to use it.

---

## 12. What We Need From You

To keep the project moving smoothly, please provide:

- **Brand assets:** final logo files and HD banner / product images.
- **Product list:** the list of products to be added, with names, short descriptions and images (nursery items can be added later, manually).
- **Contact info:** company details, contact number(s) and the WhatsApp number that should receive enquiries.
- **Membership details:** the price and exact benefits for each tier (Silver, Gold).
- **Razorpay account:** your Razorpay account / API keys for the membership payments.
- **Domain access:** access to exportersassam.com when we are ready to go live.
- **Project email:** a dedicated project email (being arranged) for development access.

---

## 13. Project Timeline

An estimated schedule. Actual dates depend on how quickly content, images and the Razorpay account are provided.

| Phase | What happens | Estimate |
|---|---|---|
| 1. Design | Website structure, black theme, page layouts, your approval. | Week 1 |
| 2. Core build | Listings, categories, company profiles, database, search. | Weeks 2–3 |
| 3. Enquiries & members | WhatsApp enquiry system, buy requirements, membership + Razorpay, admin dashboard. | Week 4 |
| 4. SEO/GEO & launch | SEO, GEO, testing, adding content, and go-live. | Week 5 |

**Approximate total:** 4–5 weeks from confirmation and content handover.

---

## 14. Maintenance & Support

- **Free period:** 3 months of free maintenance included after launch — bug fixes and small adjustments.
- **Communication:** all project updates will be shared in the WhatsApp group, and we will proceed according to your direction.
- **After 3 months:** ongoing maintenance can continue under a separate, optional arrangement.

---

## 15. What Is Not Included

- **No product transactions:** buyers and sellers do not buy/sell through the site — product enquiries route to WhatsApp. (Membership payment via Razorpay is the only on-site payment.)
- **No mobile app:** native Android / iOS apps (can be quoted separately if needed later).
- **Content creation:** professional content writing or photography beyond arranging the material you provide.
- **Ads & marketing:** paid advertising or social media management.

---

## 16. Assumptions

- The domain exportersassam.com is owned by Avadi Herbs and access will be provided at launch.
- Product data and images will be supplied by the client in a usable form.
- A Razorpay account (with API keys) will be provided by the client for membership payments.
- Any paid third-party services chosen later are billed directly to the client.

---

## 17. Next Steps

1. Review this document and share any changes.
2. Approve the scope and design direction.
3. Hand over brand assets, product list, WhatsApp number, membership prices and Razorpay keys.
4. We begin Phase 1 (design) and share progress in the WhatsApp group.

---

*Prepared by Locallify Agency • locallifyagency.com*
*This document is for client review. Scope is confirmed only on written approval.*
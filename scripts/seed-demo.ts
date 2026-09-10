/**
 * Seeds one demo category, company (with a WhatsApp number so the
 * click-to-chat link on the product page has something real to build),
 * and an approved product, so `/products/[slug]` has something real to
 * render for manual verification. Not part of the shipped feature: this
 * is a development aid, run with `npm run seed:demo`.
 *
 * Requires SEED_DEMO_WHATSAPP_NUMBER in the environment (a real number you
 * control, so the wa.me link can be manually verified end to end). Never
 * commit a real value for it. Run via `npm run seed:demo`, which loads
 * `.env.local` with Node's native `--env-file` flag (no `dotenv` dependency
 * needed).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../lib/supabase/database.types";
import { generateSlug } from "../lib/supabase/queries/slug";
import { createR2Client, uploadToR2 } from "../lib/storage/r2-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Not lib/supabase/admin.ts: that module imports "server-only", which
// throws unconditionally outside Next's own bundler (confirmed by running
// this script) rather than only when actually bundled for the browser.
// Next's build swaps it for a no-op via its module resolution; a plain
// tsx/node process has no such swap, so this script builds its own client.
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);

// Same reason as above: lib/storage/r2.ts is server-only guarded and reads
// its env vars at import time in a way this plain script can't rely on, so
// this script builds its own R2 client from lib/storage/r2-client.ts, the
// unguarded core (spec 0004's Module design).
const r2Client = createR2Client({
  accountId: process.env.R2_ACCOUNT_ID!,
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
});
const r2Config = {
  bucket: process.env.R2_BUCKET!,
  publicDomain: process.env.R2_PUBLIC_IMAGE_DOMAIN!,
};

const DEMO_CATEGORY = { name: "Agarwood & Oud", slug: "agarwood-oud" };
const DEMO_COMPANY = {
  name: "Demo Assam Agarwood Co.",
  location: "Guwahati, Assam",
  country: "India",
  email: "demo@exportsassam.com",
};
const DEMO_PRODUCT = {
  name: "Assam Agarwood Chips — Grade A",
  description:
    "Premium hand-sorted agarwood (oud) chips from Upper Assam, sustainably harvested and sun-dried. Sold by the kilogram, minimum order quantities available on request.",
};

async function main() {
  const whatsappNumber = process.env.SEED_DEMO_WHATSAPP_NUMBER;
  if (!whatsappNumber) {
    console.error(
      "SEED_DEMO_WHATSAPP_NUMBER is not set. Add a real WhatsApp number you control to .env.local so the demo product's \"Continue on WhatsApp\" link can be verified end to end, then re-run.",
    );
    process.exit(1);
  }

  const category = await upsertCategory();
  const company = await upsertCompany();
  await upsertCompanyContact(company.id, whatsappNumber);
  const imageUrl = await uploadDemoImage();
  const product = await upsertProduct(category.id, company.id, imageUrl);

  console.log("\nDemo data ready.");
  console.log(`Product page: /products/${product.slug}`);
  console.log(`Company: ${company.name} (${company.id})`);
}

async function upsertCategory() {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("categories")
    .select("id, name, slug")
    .eq("slug", DEMO_CATEGORY.slug)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert(DEMO_CATEGORY)
    .select("id, name, slug")
    .single();
  if (error) throw error;
  return data;
}

async function upsertCompany() {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("companies")
    .select("id, name")
    .eq("name", DEMO_COMPANY.name)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    // Same reasoning as upsertProduct below: a re-run should actually sync
    // DEMO_COMPANY's fields onto the existing row, not silently leave it
    // stale if this constant is ever edited.
    const { error: updateError } = await supabaseAdmin
      .from("companies")
      .update(DEMO_COMPANY)
      .eq("id", existing.id);
    if (updateError) throw updateError;
    return existing;
  }

  const { data, error } = await supabaseAdmin
    .from("companies")
    .insert({
      ...DEMO_COMPANY,
      slug: generateSlug(DEMO_COMPANY.name),
      status: "approved",
      submitted_by: "admin",
      verified: true,
    })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}

async function upsertCompanyContact(companyId: string, whatsappNumber: string) {
  const { error } = await supabaseAdmin
    .from("company_contacts")
    .upsert({ company_id: companyId, whatsapp_number: whatsappNumber }, { onConflict: "company_id" });
  if (error) throw error;
}

/**
 * Content-derived key, not a fixed one: every upload sets a one year
 * `immutable` Cache-Control (Key invariants, spec 0004), so overwriting the
 * same key on every seed run risks a CDN/browser continuing to serve stale
 * bytes if the source file's content ever changes. Hashing the bytes gives
 * a key that only changes when the content actually does — identical
 * content across re-runs reuses (and harmlessly re-uploads) the same key.
 */
async function uploadDemoImage(): Promise<string> {
  const localPath = path.join(__dirname, "..", "public", "hero_section.webp");
  const file = readFileSync(localPath);
  const contentHash = createHash("sha256").update(file).digest("hex").slice(0, 16);
  return uploadToR2(r2Client, r2Config, "products", `demo/agarwood-chips-${contentHash}.webp`, file, "image/webp");
}

async function upsertProduct(categoryId: string, companyId: string, imageUrl: string) {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("products")
    .select("id, slug, name")
    .eq("company_id", companyId)
    .eq("name", DEMO_PRODUCT.name)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    // Re-uploading the demo image (e.g. after switching storage providers)
    // should actually change what the product page renders, not leave a
    // stale image_url pointing at wherever the file used to live.
    const { error: updateError } = await supabaseAdmin
      .from("products")
      .update({ image_url: imageUrl, gallery_urls: [imageUrl] })
      .eq("id", existing.id);
    if (updateError) throw updateError;
    return existing;
  }

  let attempt = 0;
  let slug = generateSlug(DEMO_PRODUCT.name);

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .insert({
        ...DEMO_PRODUCT,
        category_id: categoryId,
        company_id: companyId,
        image_url: imageUrl,
        gallery_urls: [imageUrl],
        status: "approved",
        submitted_by: "admin",
        slug,
      })
      .select("id, slug, name")
      .single();

    if (!error) return data;

    // 23505 = unique_violation. Retry with a suffix, per the slug generation
    // contract in spec 0003; never surface a collision as a failure.
    if (error.code === "23505" && attempt < 3) {
      attempt += 1;
      slug =
        attempt < 3
          ? `${generateSlug(DEMO_PRODUCT.name)}-${attempt + 1}`
          : `${generateSlug(DEMO_PRODUCT.name)}-${Math.random().toString(36).slice(2, 8)}`;
      continue;
    }

    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

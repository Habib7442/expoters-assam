import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

/**
 * Refreshes the public site's cached pages on demand, called by the
 * separate admin app right after an admin change (approve, hide, delete,
 * edit, add). Without it, those changes waited for the pages' 5 minute
 * cache (decided 2026-09-30); the cache stays as the safety net if a call
 * here ever fails.
 *
 * Marks every cached public page stale at once: the home page, all product
 * and company pages, and the sitemap. Nothing is rebuilt here; each page
 * rebuilds on its next visit, so this costs almost no CPU however many
 * pages exist. The filtered lists and search are never cached, so they
 * need nothing.
 *
 * Guarded by REVALIDATE_SECRET (`Authorization: Bearer <secret>`), set to
 * the same value in both apps. Unset here means the endpoint is off.
 */

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return Response.json({ error: "Revalidation is not configured" }, { status: 503 });

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secretMatches(provided, secret)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  revalidatePath("/");
  revalidatePath("/products/[slug]", "page");
  revalidatePath("/companies/[slug]", "page");
  revalidatePath("/sitemap.xml");

  return Response.json({ revalidated: true });
}

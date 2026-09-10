import "server-only";
import {
  createR2Client,
  deleteFromR2 as deleteFromR2Core,
  parseR2Url as parseR2UrlCore,
  uploadToR2 as uploadToR2Core,
  type R2Category,
} from "@/lib/storage/r2-client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const accountId = requireEnv("R2_ACCOUNT_ID");
const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
const bucket = requireEnv("R2_BUCKET");
const publicDomain = requireEnv("R2_PUBLIC_IMAGE_DOMAIN");

const client = createR2Client({ accountId, accessKeyId, secretAccessKey });
const config = { bucket, publicDomain };

/**
 * App facing entry point: uploads a file to R2 and returns its public URL.
 * The only import app code should use; `lib/storage/r2-client.ts` exists
 * for the seed script, a plain Node process the `server-only` guard here
 * cannot run in.
 */
export async function uploadToR2(
  category: R2Category,
  key: string,
  file: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  return uploadToR2Core(client, config, category, key, file, contentType);
}

/** Deletes an object this bucket holds. See `r2-client.ts`'s `deleteFromR2` for why this exists. */
export async function deleteFromR2(category: R2Category, key: string): Promise<void> {
  return deleteFromR2Core(client, config, category, key);
}

/** Reverses this bucket's public URL shape back into a category and key, or `null` if it doesn't match. */
export function parseR2Url(url: string): { category: R2Category; key: string } | null {
  return parseR2UrlCore(publicDomain, url);
}

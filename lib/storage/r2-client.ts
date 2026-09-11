import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type R2Credentials = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type R2Config = {
  bucket: string;
  publicDomain: string;
};

export type R2Category = "products" | "logos" | "categories";

/**
 * Builds an S3 compatible client for Cloudflare R2. Takes credentials
 * explicitly rather than reading them from `process.env`, so this module
 * holds no ambient secret reference and stays safe for a plain script (the
 * seed script) to import directly, unlike the `server-only` guarded
 * `lib/storage/r2.ts`.
 */
export function createR2Client({ accountId, accessKeyId, secretAccessKey }: R2Credentials): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // R2's checksum handling differs from S3's; this avoids a known
    // incompatibility with the AWS SDK v3's default checksum behavior,
    // regardless of installed SDK version.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/**
 * Uploads a file to R2 and returns its public URL. The URL is built from
 * the configured public domain, never from R2's PutObject response (R2's
 * S3 compatible API returns no public URL, only a write confirmation).
 * Each path segment is individually `encodeURIComponent`'d since a
 * supplier uploaded filename may contain spaces or non ASCII characters.
 */
export async function uploadToR2(
  client: S3Client,
  config: R2Config,
  category: R2Category,
  key: string,
  file: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: `${category}/${key}`,
      Body: file,
      ContentType: contentType,
      // Object keys are treated as immutable (a changed image gets a new
      // key, never an overwrite), so caching forever is always safe.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const path = [category, ...key.split("/")].map(encodeURIComponent).join("/");
  return `https://${config.publicDomain}/${path}`;
}

/**
 * Deletes an object from R2. Not part of spec 0004's original design (it
 * deferred this as a later Follow up), but needed now because the supplier
 * business listing feature (spec 0005), built after that spec, already
 * relies on a best effort delete when a logo is replaced; moving that call
 * site to R2 without this would silently drop working cleanup behavior.
 */
export async function deleteFromR2(
  client: S3Client,
  config: R2Config,
  category: R2Category,
  key: string,
): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: `${category}/${key}` }));
}

/**
 * Reverses `uploadToR2`'s URL construction: given a public URL this bucket
 * served, returns the category and key that produced it, or `null` if the
 * URL isn't shaped like one of ours (a different domain, or malformed).
 */
export function parseR2Url(publicDomain: string, url: string): { category: R2Category; key: string } | null {
  const prefix = `https://${publicDomain}/`;
  if (!url.startsWith(prefix)) return null;

  const [categoryRaw, ...keyParts] = url.slice(prefix.length).split("/");
  if (keyParts.length === 0) return null;

  try {
    const category = decodeURIComponent(categoryRaw);
    if (category !== "products" && category !== "logos" && category !== "categories") return null;

    return { category, key: keyParts.map(decodeURIComponent).join("/") };
  } catch {
    // A malformed percent-escape (e.g. a bare "%") makes decodeURIComponent
    // throw; per this function's own contract, that's just another way a
    // URL isn't shaped like one of ours, not a crash.
    return null;
  }
}

/**
 * True only if `url` is actually hosted on this bucket's public domain
 * under a known category. Use this to guard any `next/image` render site
 * fed a stored `image_url`/`logo_url`: passing an unconfigured host to
 * `next/image` throws at render, not just a broken image, so a row still
 * pointing at the old Supabase Storage host (or anywhere else) must be
 * treated as "no image" rather than handed to `<Image>` directly. Never
 * throws itself, even on a malformed URL or percent-escape.
 */
export function isR2Url(publicDomain: string, url: string): boolean {
  return parseR2Url(publicDomain, url) !== null;
}

import { describe, expect, it, vi } from "vitest";
import type { S3Client } from "@aws-sdk/client-s3";

import { createR2Client, deleteFromR2, parseR2Url, uploadToR2 } from "./r2-client";

const CONFIG = { bucket: "exportsassam-images", publicDomain: "images.exportersasssm.com" };

function fakeClient() {
  const send = vi.fn().mockResolvedValue({});
  return { send, client: { send } as unknown as S3Client };
}

describe("createR2Client", () => {
  // covers: AC-5 (checksum config avoids the known R2/AWS SDK v3 incompatibility)
  it("constructs the S3 client with WHEN_REQUIRED checksum flags on both directions", async () => {
    const client = createR2Client({
      accountId: "acct-1",
      accessKeyId: "key-1",
      secretAccessKey: "secret-1",
    });

    await expect(client.config.requestChecksumCalculation()).resolves.toBe("WHEN_REQUIRED");
    await expect(client.config.responseChecksumValidation()).resolves.toBe("WHEN_REQUIRED");
  });

  it("points the endpoint at the given account's R2 endpoint, region auto", async () => {
    const client = createR2Client({
      accountId: "my-account",
      accessKeyId: "key-1",
      secretAccessKey: "secret-1",
    });

    await expect(client.config.region()).resolves.toBe("auto");
    await expect(client.config.endpoint?.()).resolves.toMatchObject({
      hostname: "my-account.r2.cloudflarestorage.com",
    });
  });
});

describe("uploadToR2", () => {
  // covers: AC-1 (uploaded file is reachable at its public custom domain URL, both categories)
  it.each(["products", "logos"] as const)("writes under the %s/ prefix and returns its public URL", async (category) => {
    const { send, client } = fakeClient();
    const file = new Uint8Array([1, 2, 3]);

    const url = await uploadToR2(client, CONFIG, category, "demo/agarwood-chips.webp", file, "image/webp");

    expect(url).toBe(`https://images.exportersasssm.com/${category}/demo/agarwood-chips.webp`);
    const command = send.mock.calls[0]![0];
    expect(command.input).toMatchObject({
      Bucket: "exportsassam-images",
      Key: `${category}/demo/agarwood-chips.webp`,
      Body: file,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    });
  });

  it("individually encodes each path segment, not the whole key as one blob", async () => {
    const { client } = fakeClient();

    // A supplier's Clerk user id segment could in principle need encoding;
    // the regression this guards is encoding the joined path as one string,
    // which would double-encode or mismatch a multi-segment key like this.
    const url = await uploadToR2(client, CONFIG, "logos", "user 123/a uuid.png", new Uint8Array(), "image/png");

    expect(url).toBe("https://images.exportersasssm.com/logos/user%20123/a%20uuid.png");
  });

  it("throws instead of returning a broken URL when the R2 write fails", async () => {
    const { send, client } = fakeClient();
    send.mockRejectedValueOnce(new Error("network error"));

    await expect(
      uploadToR2(client, CONFIG, "products", "x.webp", new Uint8Array(), "image/webp"),
    ).rejects.toThrow("network error");
  });
});

describe("deleteFromR2", () => {
  it("deletes the object at the category-prefixed key", async () => {
    const { send, client } = fakeClient();

    await deleteFromR2(client, CONFIG, "logos", "user_1/old.webp");

    const command = send.mock.calls[0]![0];
    expect(command.input).toMatchObject({ Bucket: "exportsassam-images", Key: "logos/user_1/old.webp" });
  });
});

describe("parseR2Url", () => {
  it("recovers the exact category and key uploadToR2 just produced (round trip)", async () => {
    const { client } = fakeClient();
    const url = await uploadToR2(client, CONFIG, "logos", "user_1/uuid.png", new Uint8Array(), "image/png");

    expect(parseR2Url(CONFIG.publicDomain, url)).toEqual({ category: "logos", key: "user_1/uuid.png" });
  });

  it("round trips a multi-segment key through encode and decode", async () => {
    const { client } = fakeClient();
    const url = await uploadToR2(client, CONFIG, "logos", "user 123/a uuid.png", new Uint8Array(), "image/png");

    expect(parseR2Url(CONFIG.publicDomain, url)).toEqual({ category: "logos", key: "user 123/a uuid.png" });
  });

  it("returns null for a URL on a different domain", () => {
    expect(parseR2Url(CONFIG.publicDomain, "https://not-our-domain.com/products/x.webp")).toBeNull();
  });

  it("returns null when the category segment isn't products or logos", () => {
    expect(parseR2Url(CONFIG.publicDomain, "https://images.exportersasssm.com/other/x.webp")).toBeNull();
  });

  it("returns null when there is no key after the category", () => {
    expect(parseR2Url(CONFIG.publicDomain, "https://images.exportersasssm.com/products")).toBeNull();
  });

  it("never throws on a malformed URL", () => {
    expect(() => parseR2Url(CONFIG.publicDomain, "not a url")).not.toThrow();
  });
});

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_DOMAIN = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN!;

/**
 * Cloudflare R2 S3-compatible client.
 * The endpoint follows the pattern: https://<accountId>.r2.cloudflarestorage.com
 */
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a buffer to R2.
 * @param key       Object key, e.g. "scholarship-thumbnails/123/thumbnail.webp"
 * @param body      File buffer
 * @param contentType MIME type
 * @param cacheControl Optional Cache-Control header for the object
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl?: string,
): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
}

/**
 * Delete an object from R2 by key (best-effort; does not throw on missing key).
 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );
}

/**
 * Build the public URL for an R2 object.
 * Requires R2_PUBLIC_DOMAIN to be set (the custom domain / r2.dev subdomain
 * configured in your Cloudflare R2 bucket settings).
 *
 * @example getPublicUrl("scholarship-thumbnails/123/thumbnail.webp")
 *   // → "https://<configured-public-domain>/scholarship-thumbnails/123/thumbnail.webp"
 */
export function getPublicUrl(key: string): string {
  return `https://${R2_PUBLIC_DOMAIN}/${key}`;
}

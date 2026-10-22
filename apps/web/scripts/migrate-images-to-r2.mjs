/**
 * Migrates scholarship thumbnail images from Supabase Storage → Cloudflare R2
 * and updates the thumbnail_url in Neon to point to the new R2 URLs.
 *
 * Usage:
 *   node apps/web/scripts/migrate-images-to-r2.mjs
 *
 * Requires these env vars (reads from apps/web/.env.local automatically):
 *   DATABASE_URL, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, NEXT_PUBLIC_R2_PUBLIC_DOMAIN
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ────────────────────────────────────────────────────────────
const envPath = resolve(__dirname, "../.env.local");
const envVars = readFileSync(envPath, "utf-8")
  .split("\n")
  .reduce((acc, line) => {
    const clean = line.replace(/#.*$/, "").trim();
    const idx = clean.indexOf("=");
    if (idx > 0) {
      const key = clean.slice(0, idx).trim();
      const val = clean.slice(idx + 1).trim();
      if (key && val) acc[key] = val;
    }
    return acc;
  }, {});

const env = (k) => envVars[k] ?? process.env[k] ?? "";

const DATABASE_URL         = env("DATABASE_URL");
const R2_ACCOUNT_ID        = env("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID     = env("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = env("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME       = env("R2_BUCKET_NAME");
const R2_PUBLIC_DOMAIN     = env("NEXT_PUBLIC_R2_PUBLIC_DOMAIN");

if (!DATABASE_URL || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_DOMAIN) {
  console.error("Missing required env vars. Check .env.local");
  process.exit(1);
}

// ── Clients ────────────────────────────────────────────────────────────────────
const sql = neon(DATABASE_URL);

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ── Generic migrate helper ─────────────────────────────────────────────────────
async function migrateImages({ label, rows, urlColumn, updateFn }) {
  console.log(`\n[${label}] Found ${rows.length} item(s) with Supabase URLs.`);
  let ok = 0, failed = 0;

  for (const row of rows) {
    const id = row.id;
    const imageUrl = row[urlColumn];

    try {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        console.warn(`  SKIP [${id}] — HTTP ${res.status}`);
        failed++;
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "image/webp";

      // Derive R2 key from Supabase URL path
      // e.g. /storage/v1/object/public/scholarship-thumbnails/UUID/thumbnail.webp
      //   →  scholarship-thumbnails/UUID/thumbnail.webp
      const key = new URL(imageUrl).pathname.replace(/^\/storage\/v1\/object\/public\//, "");

      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      const newUrl = `https://${R2_PUBLIC_DOMAIN}/${key}`;
      await updateFn(id, newUrl);

      console.log(`  OK  [${id}] → ${newUrl}`);
      ok++;
    } catch (err) {
      console.error(`  ERR [${id}] —`, err.message);
      failed++;
    }
  }

  console.log(`  → ${ok} migrated, ${failed} failed.`);
  return { ok, failed };
}

// ── Main ───────────────────────────────────────────────────────────────────────

// 1. Scholarship thumbnails (shown on list, details, and AI Picks on dashboard)
const scholarships = await sql`
  SELECT id, thumbnail_url
  FROM public.scholarships
  WHERE thumbnail_url LIKE '%supabase.co%'
`;
await migrateImages({
  label: "scholarship thumbnails",
  rows: scholarships,
  urlColumn: "thumbnail_url",
  updateFn: (id, newUrl) => sql`
    UPDATE public.scholarships SET thumbnail_url = ${newUrl} WHERE id = ${id}
  `,
});

// 2. Guide cover images
const guides = await sql`
  SELECT id, cover_image_url
  FROM public.guides
  WHERE cover_image_url LIKE '%supabase.co%'
`;
await migrateImages({
  label: "guide covers",
  rows: guides,
  urlColumn: "cover_image_url",
  updateFn: (id, newUrl) => sql`
    UPDATE public.guides SET cover_image_url = ${newUrl} WHERE id = ${id}
  `,
});

console.log("\nAll done.");

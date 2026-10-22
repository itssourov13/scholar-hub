/**
 * Applies the CORS policy for the configured ScholarHub site and local development.
 *
 * Without this, R2 answers every request with no Access-Control-Allow-Origin
 * and rejects preflights with 403. Plain <img src> loads still work (they are
 * no-cors requests), but anything that needs CORS mode — reading a thumbnail
 * into a canvas, a download button, fetch() — fails.
 *
 * Usage:
 *   node apps/web/scripts/set-r2-cors.mjs          # apply, then print result
 *   node apps/web/scripts/set-r2-cors.mjs --dry    # print the policy only
 *
 * Requires these env vars (reads from apps/web/.env.local automatically):
 *   R2_ACCOUNT_ID, R2_BUCKET_NAME
 *
 * Bucket-level configuration needs an "Admin Read & Write" R2 token; the
 * object-scoped key the app uses at runtime gets AccessDenied here. Set
 * R2_ADMIN_ACCESS_KEY_ID / R2_ADMIN_SECRET_ACCESS_KEY to use an admin token
 * without swapping the app's credentials; otherwise R2_ACCESS_KEY_ID /
 * R2_SECRET_ACCESS_KEY are used.
 */

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ────────────────────────────────────────────────────────────
const envPath = resolve(__dirname, "../.env.local");
const envVars = (existsSync(envPath) ? readFileSync(envPath, "utf-8") : "")
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

const R2_ACCOUNT_ID        = env("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID     = env("R2_ADMIN_ACCESS_KEY_ID") || env("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = env("R2_ADMIN_SECRET_ACCESS_KEY") || env("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME       = env("R2_BUCKET_NAME");
const SITE_URL             = env("NEXT_PUBLIC_SITE_URL");

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("Missing R2 env vars. Check apps/web/.env.local.");
  process.exit(1);
}

// Only the web origins need to be listed. Expo/React Native and server-side
// fetches don't enforce CORS, so the mobile app needs nothing here.
const SITE_ORIGIN = SITE_URL ? new URL(SITE_URL).origin : "";
const ALLOWED_ORIGINS = [
  SITE_ORIGIN,
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean);

const CORS_RULES = [
  {
    AllowedOrigins: ALLOWED_ORIGINS,
    AllowedMethods: ["GET", "HEAD"],
    AllowedHeaders: ["Range", "Content-Type"],
    // Lets canvas/fetch consumers read these off the response.
    ExposeHeaders: ["Content-Length", "Content-Type", "ETag"],
    MaxAgeSeconds: 86400,
  },
];

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const dryRun = process.argv.includes("--dry");

console.log(`Bucket: ${R2_BUCKET_NAME}`);
console.log(JSON.stringify(CORS_RULES, null, 2));

if (dryRun) {
  console.log("\n--dry given, nothing applied.");
  process.exit(0);
}

try {
  await r2.send(
    new PutBucketCorsCommand({
      Bucket: R2_BUCKET_NAME,
      CORSConfiguration: { CORSRules: CORS_RULES },
    }),
  );
} catch (err) {
  if (err?.name === "AccessDenied") {
    console.error(
      "\nAccessDenied — this key can read/write objects but not bucket config.\n" +
        "Create an R2 API token with 'Admin Read & Write', then either set\n" +
        "R2_ADMIN_ACCESS_KEY_ID / R2_ADMIN_SECRET_ACCESS_KEY in .env.local or run:\n" +
        "  R2_ADMIN_ACCESS_KEY_ID=… R2_ADMIN_SECRET_ACCESS_KEY=… node apps/web/scripts/set-r2-cors.mjs",
    );
    process.exit(1);
  }
  throw err;
}
console.log("\nApplied. Reading it back:");

const current = await r2.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET_NAME }));
console.log(JSON.stringify(current.CORSRules, null, 2));

/**
 * One-time migration: re-compress all existing scholarship thumbnails and guide
 * covers to WebP and update the corresponding DB records.
 *
 * After migration, every newly written URL is verified with an HTTP GET:
 *   - Status must be 200
 *   - Content-Type must start with "image/"
 *   - Body must be > 0 bytes
 * A full report is printed to the console and written to
 *   scripts/migration-report-<timestamp>.json
 *
 * Usage (from apps/web/):
 *   npx tsx scripts/migrate-images-to-webp.ts          # live run
 *   DRY_RUN=1 npx tsx scripts/migrate-images-to-webp.ts  # dry run (no writes, no verify)
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { writeFileSync } from "fs";
import { resolve } from "path";

// Load .env.local automatically (Node 20.12+ built-in, no dotenv needed)
try { process.loadEnvFile(".env.local"); } catch { /* file absent — env vars must be set externally */ }

// ── config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DRY_RUN = process.env.DRY_RUN === "1";
// Milliseconds to wait between verification requests (avoids hammering CDN)
const VERIFY_DELAY_MS = 300;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── types ─────────────────────────────────────────────────────────────────────

type MigrateStatus = "migrated" | "skipped" | "failed";
type VerifyStatus = "pass" | "fail" | "skipped";

interface ImageResult {
  kind: "thumbnail" | "cover";
  id: string;
  title: string;
  originalUrl: string;
  newUrl: string;
  originalKB: number | null;
  compressedKB: number | null;
  savingPct: number | null;
  migrateStatus: MigrateStatus;
  migrateError: string | null;
  verifyStatus: VerifyStatus;
  verifyHttpStatus: number | null;
  verifyContentType: string | null;
  verifySizeBytes: number | null;
  verifyError: string | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function compressToWebp(
  buffer: Buffer,
  maxWidth: number,
  quality: number,
): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── verification ──────────────────────────────────────────────────────────────

async function verifyUrl(url: string): Promise<{
  httpStatus: number | null;
  contentType: string | null;
  sizeBytes: number | null;
  pass: boolean;
  reason: string | null;
}> {
  try {
    const res = await fetch(url);
    const httpStatus = res.status;
    const contentType = res.headers.get("content-type");
    const body = Buffer.from(await res.arrayBuffer());
    const sizeBytes = body.byteLength;

    if (httpStatus !== 200) {
      return { httpStatus, contentType, sizeBytes, pass: false, reason: `HTTP ${httpStatus}` };
    }
    if (!contentType?.startsWith("image/")) {
      return { httpStatus, contentType, sizeBytes, pass: false, reason: `Bad content-type: ${contentType}` };
    }
    if (sizeBytes === 0) {
      return { httpStatus, contentType, sizeBytes, pass: false, reason: "Empty body (0 bytes)" };
    }
    return { httpStatus, contentType, sizeBytes, pass: true, reason: null };
  } catch (err) {
    return { httpStatus: null, contentType: null, sizeBytes: null, pass: false, reason: (err as Error).message };
  }
}

// ── migrate ───────────────────────────────────────────────────────────────────

async function migrateScholarshipThumbnails(): Promise<ImageResult[]> {
  console.log("\n═══ Scholarship thumbnails ═══");

  const { data: scholarships, error } = await supabase
    .from("scholarships")
    .select("id, title, thumbnail_url")
    .not("thumbnail_url", "is", null);

  if (error) throw error;
  if (!scholarships?.length) {
    console.log("  No scholarships with thumbnails found.");
    return [];
  }

  const results: ImageResult[] = [];

  for (const s of scholarships) {
    const originalUrl: string = s.thumbnail_url;
    const newPath = `${s.id}/thumbnail.webp`;
    const { data: { publicUrl: newUrl } } = supabase.storage
      .from("scholarship-thumbnails")
      .getPublicUrl(newPath);

    const result: ImageResult = {
      kind: "thumbnail",
      id: s.id,
      title: s.title,
      originalUrl,
      newUrl,
      originalKB: null,
      compressedKB: null,
      savingPct: null,
      migrateStatus: "failed",
      migrateError: null,
      verifyStatus: "skipped",
      verifyHttpStatus: null,
      verifyContentType: null,
      verifySizeBytes: null,
      verifyError: null,
    };

    if (originalUrl === newUrl) {
      console.log(`  SKIP  "${s.title}" — already migrated`);
      result.migrateStatus = "skipped";
      results.push(result);
      continue;
    }

    try {
      process.stdout.write(`  Processing "${s.title}" … `);
      const original = await downloadImage(originalUrl.split("?")[0]);
      const compressed = await compressToWebp(original, 640, 80);
      result.originalKB = Math.round(original.byteLength / 1024);
      result.compressedKB = Math.round(compressed.byteLength / 1024);
      result.savingPct = Math.round((1 - compressed.byteLength / original.byteLength) * 100);
      process.stdout.write(`${result.originalKB} KB → ${result.compressedKB} KB (${result.savingPct}% smaller)`);

      if (!DRY_RUN) {
        const { error: uploadErr } = await supabase.storage
          .from("scholarship-thumbnails")
          .upload(newPath, compressed, { contentType: "image/webp", upsert: true });
        if (uploadErr) throw uploadErr;

        const { error: updateErr } = await supabase
          .from("scholarships")
          .update({ thumbnail_url: newUrl })
          .eq("id", s.id);
        if (updateErr) throw updateErr;
      }

      result.migrateStatus = "migrated";
      console.log("  ✓");
    } catch (err) {
      result.migrateError = (err as Error).message;
      result.migrateStatus = "failed";
      console.log(`  ✗ ${result.migrateError}`);
    }

    results.push(result);
  }

  return results;
}

async function migrateGuideCovers(): Promise<ImageResult[]> {
  console.log("\n═══ Guide covers ═══");

  const { data: guides, error } = await supabase
    .from("guides")
    .select("id, title, cover_image_url")
    .not("cover_image_url", "is", null);

  if (error) {
    console.log(`  Could not query guides: ${error.message}`);
    return [];
  }
  if (!guides?.length) {
    console.log("  No guides with covers found.");
    return [];
  }

  const results: ImageResult[] = [];

  for (const g of guides) {
    const originalUrl: string = g.cover_image_url;
    const newPath = `${g.id}/cover.webp`;
    const { data: { publicUrl: newUrl } } = supabase.storage
      .from("guide-covers")
      .getPublicUrl(newPath);

    const result: ImageResult = {
      kind: "cover",
      id: g.id,
      title: g.title,
      originalUrl,
      newUrl,
      originalKB: null,
      compressedKB: null,
      savingPct: null,
      migrateStatus: "failed",
      migrateError: null,
      verifyStatus: "skipped",
      verifyHttpStatus: null,
      verifyContentType: null,
      verifySizeBytes: null,
      verifyError: null,
    };

    if (originalUrl === newUrl) {
      console.log(`  SKIP  "${g.title}" — already migrated`);
      result.migrateStatus = "skipped";
      results.push(result);
      continue;
    }

    try {
      process.stdout.write(`  Processing "${g.title}" … `);
      const original = await downloadImage(originalUrl.split("?")[0]);
      const compressed = await compressToWebp(original, 1200, 82);
      result.originalKB = Math.round(original.byteLength / 1024);
      result.compressedKB = Math.round(compressed.byteLength / 1024);
      result.savingPct = Math.round((1 - compressed.byteLength / original.byteLength) * 100);
      process.stdout.write(`${result.originalKB} KB → ${result.compressedKB} KB (${result.savingPct}% smaller)`);

      if (!DRY_RUN) {
        const { error: uploadErr } = await supabase.storage
          .from("guide-covers")
          .upload(newPath, compressed, { contentType: "image/webp", upsert: true });
        if (uploadErr) throw uploadErr;

        const { error: updateErr } = await supabase
          .from("guides")
          .update({ cover_image_url: newUrl })
          .eq("id", g.id);
        if (updateErr) throw updateErr;
      }

      result.migrateStatus = "migrated";
      console.log("  ✓");
    } catch (err) {
      result.migrateError = (err as Error).message;
      result.migrateStatus = "failed";
      console.log(`  ✗ ${result.migrateError}`);
    }

    results.push(result);
  }

  return results;
}

// ── verification phase ────────────────────────────────────────────────────────

async function verifyAll(results: ImageResult[]) {
  const toVerify = results.filter((r) => r.migrateStatus === "migrated");
  if (!toVerify.length) {
    console.log("\n  Nothing to verify.");
    return;
  }

  console.log(`\n═══ Verifying ${toVerify.length} new URLs ═══`);
  console.log("  (HEAD-fetching each URL from Supabase CDN — may take a moment)\n");

  for (const r of toVerify) {
    process.stdout.write(`  ${r.kind === "thumbnail" ? "🖼 " : "📄 "} "${r.title}" … `);
    await sleep(VERIFY_DELAY_MS);
    const v = await verifyUrl(r.newUrl);

    r.verifyHttpStatus = v.httpStatus;
    r.verifyContentType = v.contentType;
    r.verifySizeBytes = v.sizeBytes;
    r.verifyError = v.reason;
    r.verifyStatus = v.pass ? "pass" : "fail";

    if (v.pass) {
      const kb = v.sizeBytes ? Math.round(v.sizeBytes / 1024) : "?";
      console.log(`✓  HTTP 200  ${v.contentType}  ${kb} KB`);
    } else {
      console.log(`✗  ${v.reason}`);
    }
  }
}

// ── report ────────────────────────────────────────────────────────────────────

function printReport(results: ImageResult[]) {
  const migrated  = results.filter((r) => r.migrateStatus === "migrated");
  const skipped   = results.filter((r) => r.migrateStatus === "skipped");
  const failed    = results.filter((r) => r.migrateStatus === "failed");
  const verified  = results.filter((r) => r.verifyStatus === "pass");
  const verFailed = results.filter((r) => r.verifyStatus === "fail");

  const totalOriginalKB  = migrated.reduce((s, r) => s + (r.originalKB ?? 0), 0);
  const totalCompressedKB = migrated.reduce((s, r) => s + (r.compressedKB ?? 0), 0);
  const overallSaving = totalOriginalKB > 0
    ? Math.round((1 - totalCompressedKB / totalOriginalKB) * 100)
    : 0;

  console.log("\n" + "═".repeat(58));
  console.log("  MIGRATION REPORT");
  console.log("═".repeat(58));
  console.log(`  Total images processed : ${results.length}`);
  console.log(`  Migrated               : ${migrated.length}`);
  console.log(`  Skipped (already done) : ${skipped.length}`);
  console.log(`  Migration failures     : ${failed.length}`);
  console.log("─".repeat(58));
  console.log(`  Original size total    : ${totalOriginalKB} KB`);
  console.log(`  Compressed size total  : ${totalCompressedKB} KB`);
  console.log(`  Overall saving         : ${overallSaving}%`);
  console.log("─".repeat(58));
  console.log(`  Verified (HTTP 200 ✓)  : ${verified.length}`);
  console.log(`  Verification failures  : ${verFailed.length}`);
  console.log("═".repeat(58));

  if (failed.length > 0) {
    console.log("\n  Migration failures:");
    for (const r of failed) {
      console.log(`    ✗ [${r.kind}] "${r.title}"`);
      console.log(`      ${r.migrateError}`);
    }
  }

  if (verFailed.length > 0) {
    console.log("\n  Verification failures:");
    for (const r of verFailed) {
      console.log(`    ✗ [${r.kind}] "${r.title}"`);
      console.log(`      URL  : ${r.newUrl}`);
      console.log(`      Reason: ${r.verifyError}`);
    }
  }

  if (failed.length === 0 && verFailed.length === 0 && migrated.length > 0) {
    console.log("\n  All images migrated and verified successfully. ✓");
  }
}

function saveReport(results: ImageResult[]) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `migration-report-${timestamp}.json`;
  const outPath = resolve(__dirname, filename);

  const summary = {
    generatedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    total: results.length,
    migrated: results.filter((r) => r.migrateStatus === "migrated").length,
    skipped: results.filter((r) => r.migrateStatus === "skipped").length,
    migrationFailures: results.filter((r) => r.migrateStatus === "failed").length,
    verifyPass: results.filter((r) => r.verifyStatus === "pass").length,
    verifyFail: results.filter((r) => r.verifyStatus === "fail").length,
  };

  writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2), "utf8");
  console.log(`\n  Full report saved to: ${outPath}`);
}

// ── entry point ───────────────────────────────────────────────────────────────

async function main() {
  const startedAt = Date.now();
  console.log(DRY_RUN
    ? "═══ DRY RUN — no files will be written, no verification ═══"
    : "═══ LIVE RUN ═══"
  );

  const thumbnailResults = await migrateScholarshipThumbnails();
  const coverResults     = await migrateGuideCovers();
  const allResults       = [...thumbnailResults, ...coverResults];

  if (!DRY_RUN) {
    await verifyAll(allResults);
  }

  printReport(allResults);

  if (!DRY_RUN) {
    saveReport(allResults);
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n  Completed in ${elapsed}s\n`);

  // Exit with non-zero if anything failed, so CI/scripts can detect it
  const anyFailed =
    allResults.some((r) => r.migrateStatus === "failed") ||
    allResults.some((r) => r.verifyStatus === "fail");
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import {
  assessScholarshipDataset,
  SOURCE_DATASET,
  type ExistingScholarship,
  type RawScholarshipRecord,
} from "../src/lib/scholarship-import";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const jsonOutput = args.includes("--json");
const targetIndex = args.indexOf("--target");
const target = targetIndex >= 0 ? args[targetIndex + 1] : "";
const reportIndex = args.indexOf("--write-report");
const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : null;

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set. Load apps/web/.env.local; do not put the connection string in source or arguments.");

let parsedDatabaseUrl: URL;
try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  fail("DATABASE_URL is not a valid URL.");
}

if (!["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol)) {
  fail("DATABASE_URL must use the postgres/postgresql protocol.");
}

if (apply) {
  const expectedHost = process.env.SCHOLARHUB_STAGING_HOST?.trim().toLowerCase();
  if (target !== "staging" || process.env.SCHOLARHUB_IMPORT_TARGET !== "staging") {
    fail("Writes are disabled unless both --target staging and SCHOLARHUB_IMPORT_TARGET=staging are explicitly set.");
  }
  if (!expectedHost || parsedDatabaseUrl.hostname.toLowerCase() !== expectedHost) {
    fail("Staging host safety check failed. Set SCHOLARHUB_STAGING_HOST to the exact reviewed Neon staging endpoint; the script will not write to an unrecognised database host.");
  }
}

const dataPath = resolve(process.cwd(), "cleaned_scholarships.json");
let rawRows: RawScholarshipRecord[];
try {
  rawRows = JSON.parse(await readFile(dataPath, "utf8")) as RawScholarshipRecord[];
  if (!Array.isArray(rawRows)) fail("cleaned_scholarships.json must contain a JSON array.");
} catch (error) {
  fail(`Could not load cleaned_scholarships.json: ${String(error)}`);
}

const sql = neon(databaseUrl);
const identity = await sql`
  SELECT current_database() AS database_name, current_user AS role_name,
         current_schema() AS schema_name, current_setting('server_version') AS server_version
`;

const requiredColumns = [
  "required_documents",
  "source_dataset",
  "source_record_id",
  "source_observed_at",
  "source_verified_at",
  "source_last_checked_at",
  "source_verification_status",
];
const schemaRows = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'scholarships'
`;
const availableColumns = new Set(schemaRows.map((row) => String(row.column_name)));
const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column));
if (missingColumns.length) {
  fail(`Schema is not ready. Missing public.scholarships columns: ${missingColumns.join(", ")}. Apply and verify 028_scholarship_import_provenance.sql on staging first.`);
}

const existingRows = await sql`
  SELECT id::text AS id, title, country, official_url, slug, source_dataset, source_record_id
  FROM public.scholarships
` as ExistingScholarship[];

const asOf = new Date();
const decisions = assessScholarshipDataset(rawRows, existingRows, asOf);
const counts = {
  sourceRows: decisions.length,
  importable: decisions.filter((item) => item.decision === "importable").length,
  needsReview: decisions.filter((item) => item.decision === "needs_review").length,
  alreadyImported: decisions.filter((item) => item.decision === "already_imported").length,
};
const reasons: Record<string, number> = {};
const warnings: Record<string, number> = {};
for (const item of decisions) {
  for (const reason of item.reasons) reasons[reason] = (reasons[reason] ?? 0) + 1;
  for (const warning of item.warnings) warnings[warning] = (warnings[warning] ?? 0) + 1;
}

const existingSlugs = new Set(
  existingRows.map((item) => item.slug).filter((value): value is string => Boolean(value)),
);
function uniqueSlug(base: string): string {
  if (!existingSlugs.has(base)) {
    existingSlugs.add(base);
    return base;
  }
  let suffix = 2;
  while (existingSlugs.has(`${base}-${suffix}`)) suffix += 1;
  const slug = `${base}-${suffix}`;
  existingSlugs.add(slug);
  return slug;
}

const written: { rowNumber: number; id: string }[] = [];
const writeErrors: { rowNumber: number; error: string }[] = [];

if (apply) {
  if (String(identity[0]?.database_name) !== "neondb") {
    fail(`Unexpected database name '${String(identity[0]?.database_name)}'; staging import is restricted to neondb.`);
  }

  // Rows are inserted individually with a stable source key. If execution is
  // interrupted, rerunning the script skips successful rows instead of
  // creating duplicates. All writes remain drafts and is_live=false.
  for (const decision of decisions.filter((item) => item.decision === "importable")) {
    const record = decision.record;
    const sourceRecordId = decision.sourceRecordId;
    if (!record || !sourceRecordId) continue;
    try {
      const inserted = await sql`
        INSERT INTO public.scholarships (
          title, country, degree_level, funding_type, deadline, official_url,
          raw_description, status, slug, is_live, is_flagship, tags,
          source_dataset, source_record_id, source_observed_at,
          source_verification_status
        )
        VALUES (
          ${record.title}, ${record.country}, ${record.degreeLevel},
          ${record.fundingType}, ${record.deadline}, ${record.officialUrl},
          ${record.rawDescription}, 'draft', ${uniqueSlug(record.slugBase)},
          false, false, '[]'::jsonb, ${SOURCE_DATASET}, ${sourceRecordId},
          ${record.sourceObservedAt}, 'unverified'
        )
        ON CONFLICT (source_dataset, source_record_id)
          WHERE source_dataset IS NOT NULL AND source_record_id IS NOT NULL
        DO NOTHING
        RETURNING id::text AS id
      `;
      if (inserted[0]?.id) written.push({ rowNumber: decision.rowNumber, id: String(inserted[0].id) });
    } catch (error) {
      writeErrors.push({ rowNumber: decision.rowNumber, error: String(error).slice(0, 400) });
    }
  }
}

const result = {
  mode: apply ? "apply-staging" : "dry-run-read-only",
  database: {
    host: parsedDatabaseUrl.hostname,
    name: String(identity[0]?.database_name ?? "unknown"),
    role: String(identity[0]?.role_name ?? "unknown"),
    serverVersion: String(identity[0]?.server_version ?? "unknown"),
  },
  dataset: SOURCE_DATASET,
  asOf: asOf.toISOString(),
  counts: apply ? { ...counts, inserted: written.length, writeErrors: writeErrors.length } : counts,
  reasonCounts: reasons,
  warningCounts: warnings,
  insertedRows: written,
  writeErrors,
  decisions,
};

if (reportPath) {
  await writeFile(resolve(process.cwd(), reportPath), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
}
if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Mode: ${result.mode}`);
  console.log(`Database: ${result.database.name} @ ${result.database.host} (role ${result.database.role})`);
  console.log(`Dataset rows: ${counts.sourceRows}`);
  console.log(`Importable unique candidates: ${counts.importable}`);
  console.log(`Needs human review; not inserted: ${counts.needsReview}`);
  console.log(`Already imported: ${counts.alreadyImported}`);
  console.log("\nReview reasons:");
  for (const [reason, count] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`  ${reason}: ${count}`);
  console.log("\nData-quality warnings on candidate rows:");
  for (const [warning, count] of Object.entries(warnings).sort((a, b) => b[1] - a[1])) console.log(`  ${warning}: ${count}`);
  if (apply) {
    console.log(`\nInserted draft rows: ${written.length}`);
    console.log(`Write errors: ${writeErrors.length}`);
    if (writeErrors.length) for (const error of writeErrors) console.log(`  row ${error.rowNumber}: ${error.error}`);
  }
  console.log("\nNo record was published. Every insert is status=draft, is_live=false, source_verification_status=unverified.");
}
}

main().catch((error) => {
  console.error(`IMPORT_SCRIPT_FAILED: ${String(error).slice(0, 1000)}`);
  process.exitCode = 1;
});

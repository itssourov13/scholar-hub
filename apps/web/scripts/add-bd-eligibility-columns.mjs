// Additive, non-destructive migration: adds nullable columns used by the
// admin "Parse + Scrape" Bangladeshi-eligibility check.
// Run: node scripts/add-bd-eligibility-columns.mjs
import { neon } from "@neondatabase/serverless";
import fs from "fs";

let url = process.env.DATABASE_URL;
if (!url) {
  const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const match = envFile.match(/^DATABASE_URL=(.*)$/m);
  if (match) url = match[1].trim();
}
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(url);

await sql`ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS bangladeshi_eligible BOOLEAN`;
await sql`ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS bangladeshi_eligibility_note TEXT`;
console.log("✓ scholarships.bangladeshi_eligible / bangladeshi_eligibility_note columns ensured");

const rows = await sql`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'scholarships' AND column_name LIKE 'bangladeshi%'
`;
console.log(rows);

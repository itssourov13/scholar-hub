// Additive, non-destructive migration: adds a nullable jsonb column used to
// cache the AI-generated "documents required" list per scholarship.
// Run: DATABASE_URL="..." node scripts/add-required-documents-column.mjs
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(url);

await sql`ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS required_documents jsonb`;
console.log("✓ scholarships.required_documents column ensured");

const [{ count }] = await sql`
  SELECT count(*)::int AS count FROM scholarships WHERE required_documents IS NOT NULL
`;
console.log(`  rows with cached documents: ${count}`);

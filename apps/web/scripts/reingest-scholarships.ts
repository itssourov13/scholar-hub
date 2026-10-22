/**
 * Re-embeds every published scholarship into the `ScholarshipDoc` pgvector
 * store using the current chunking in src/lib/rag-ingest.ts.
 *
 * Run after any change to the chunk format — the mentor's answers are only as
 * good as what is indexed, and old chunks are not migrated automatically.
 *
 *   pnpm --filter web reingest            # all published scholarships
 *   pnpm --filter web reingest <uuid> ... # specific ones
 */

import { sql } from "@/utils/db";
import { ingestScholarship, type ScholarshipIngestRecord } from "@/lib/rag-ingest";

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is not set");
    process.exit(1);
  }

  const ids = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));

  const rows = (
    ids.length
      ? await sql`
          SELECT id, title, country, degree_level, funding_type, deadline, is_live, opening_note,
                 official_url, competitiveness, eligibility_summary, slug, raw_description,
                 ai_summary, tips, tags, required_documents
          FROM scholarships
          WHERE id = ANY(${ids}::uuid[])
          ORDER BY title
        `
      : await sql`
          SELECT id, title, country, degree_level, funding_type, deadline, is_live, opening_note,
                 official_url, competitiveness, eligibility_summary, slug, raw_description,
                 ai_summary, tips, tags, required_documents
          FROM scholarships
          WHERE status = 'published'
          ORDER BY title
        `
  ) as ScholarshipIngestRecord[];

  console.log(`Re-ingesting ${rows.length} scholarship(s)...\n`);

  let totalChunks = 0;
  const failures: { title: string; error: string }[] = [];

  for (const [index, record] of rows.entries()) {
    const label = `[${index + 1}/${rows.length}] ${record.title}`;
    const result = await ingestScholarship(record, apiKey);

    if (result.error) {
      failures.push({ title: record.title, error: result.error });
      console.error(`✗ ${label}\n    ${result.error}`);
    } else {
      totalChunks += result.chunks;
      console.log(`✓ ${label} — ${result.chunks} chunks`);
    }
  }

  console.log(
    `\nDone. ${rows.length - failures.length} succeeded, ${failures.length} failed, ${totalChunks} chunks written.`,
  );

  const [stats] = (await sql`
    SELECT count(*)::int AS chunks,
           count(*) FILTER (WHERE content LIKE '%Deadline%')::int AS with_deadline
    FROM "ScholarshipDoc"
  `) as { chunks: number; with_deadline: number }[];

  console.log(`Index now holds ${stats.chunks} chunks, ${stats.with_deadline} carrying a deadline.`);

  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

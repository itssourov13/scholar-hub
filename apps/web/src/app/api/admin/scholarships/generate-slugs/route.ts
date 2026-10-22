import { NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { requireAdmin } from "@/utils/api-auth";
import { generateScholarshipSlug, makeSlugUnique } from "@/lib/slug";

/**
 * POST /api/admin/scholarships/generate-slugs
 *
 * Backfills slugs for all scholarships that don't have one yet.
 * Safe to run multiple times — only updates rows where slug IS NULL.
 *
 * Returns a summary of how many slugs were generated.
 */
export async function POST() {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all scholarships without a slug
  const rows = await sql`
    SELECT id, title, country FROM scholarships WHERE slug IS NULL ORDER BY created_at
  `;

  if (rows.length === 0) {
    return NextResponse.json({ updated: 0, message: "All scholarships already have slugs." });
  }

  // Fetch existing slugs to avoid collisions
  const existingRows = await sql`SELECT slug FROM scholarships WHERE slug IS NOT NULL`;
  const existingSlugs = new Set(existingRows.map((r) => r.slug as string));

  let updated = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const base = generateScholarshipSlug(row.title as string, row.country as string);
    if (!base) {
      errors.push(`Skipped id=${row.id}: could not generate slug from title="${row.title}" country="${row.country}"`);
      continue;
    }

    const slug = makeSlugUnique(base, existingSlugs);
    existingSlugs.add(slug); // reserve it for subsequent iterations

    try {
      await sql`
        UPDATE scholarships SET slug = ${slug}, updated_at = NOW()
        WHERE id = ${row.id as string}
      `;
      updated++;
    } catch (err) {
      errors.push(`Failed id=${row.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    updated,
    total: rows.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `Generated slugs for ${updated} of ${rows.length} scholarships.`,
  });
}

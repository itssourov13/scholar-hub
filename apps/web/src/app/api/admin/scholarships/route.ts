import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { requireAdmin } from "@/utils/api-auth";
import { generateScholarshipSlug, makeSlugUnique } from "@/lib/slug";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`
    SELECT id, title, country, status, created_at, updated_at,
           thumbnail_url, degree_level, funding_type, deadline, is_flagship,
           bangladeshi_eligible
    FROM scholarships
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ scholarships: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Generate a unique slug for the new scholarship
  const slugBase = generateScholarshipSlug(body.title as string, body.country as string);
  const existingRows = await sql`SELECT slug FROM scholarships WHERE slug IS NOT NULL`;
  const existingSlugs = new Set(existingRows.map((r) => r.slug as string));
  const slug = slugBase ? makeSlugUnique(slugBase, existingSlugs) : null;

  const rows = await sql`
    INSERT INTO scholarships (created_by, title, country, degree_level, funding_type, deadline, official_url, raw_description, status, slug, is_live, opening_note, bangladeshi_eligible, bangladeshi_eligibility_note)
    VALUES (
      ${auth.userId},
      ${body.title as string},
      ${body.country as string},
      ${body.degree_level as string},
      ${body.funding_type as string},
      ${(body.deadline as string | null) ?? null},
      ${(body.official_url as string | null) ?? null},
      ${(body.raw_description as string | null) ?? null},
      'draft',
      ${slug},
      ${(body.is_live as boolean | null) ?? true},
      ${(body.opening_note as string | null) ?? null},
      ${(body.bangladeshi_eligible as boolean | null) ?? true},
      ${(body.bangladeshi_eligibility_note as string | null) ?? null}
    )
    RETURNING *
  `;

  return NextResponse.json({ scholarship: rows[0] }, { status: 201 });
}

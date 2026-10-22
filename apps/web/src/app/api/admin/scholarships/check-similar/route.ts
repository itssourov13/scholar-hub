import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { requireAdmin } from "@/utils/api-auth";
import { findSimilarScholarships, type ScholarshipRow } from "@/lib/dedupe";

export type { SimilarMatch } from "@/lib/dedupe";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; country?: string; official_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, country, official_url } = body;
  if (!title?.trim()) {
    return NextResponse.json({ matches: [] });
  }

  const rows = (await sql`
    SELECT id, title, country, status, slug, official_url
    FROM scholarships
    WHERE status != 'archived'
    ORDER BY created_at DESC
  `) as ScholarshipRow[];

  const matches = findSimilarScholarships(rows, { title, country, official_url });

  return NextResponse.json({ matches: matches.slice(0, 5) });
}

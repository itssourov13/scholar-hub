import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { requireAdmin } from "@/utils/api-auth";
import { logRequest } from "@/lib/nim";
import { ingestScholarship, type ScholarshipIngestRecord } from "@/lib/rag-ingest";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY is not configured" }, { status: 500 });

  const { id } = await params;
  const rows = await sql`
    SELECT id, title, country, degree_level, funding_type, deadline, is_live, opening_note,
           official_url, competitiveness, eligibility_summary, slug, raw_description,
           ai_summary, tips, tags, required_documents
    FROM scholarships WHERE id = ${id} LIMIT 1
  `;
  const scholarship = rows[0] as ScholarshipIngestRecord | undefined;
  if (!scholarship) return NextResponse.json({ error: "Scholarship not found" }, { status: 404 });

  const result = await ingestScholarship(scholarship, apiKey);
  if (result.error) {
    logRequest("rag.ingest.failed", { scholarshipId: scholarship.id, error: result.error });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  logRequest("rag.ingest.complete", { scholarshipId: scholarship.id, chunks: result.chunks });
  return NextResponse.json({ chunks: result.chunks });
}

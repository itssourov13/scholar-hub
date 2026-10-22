import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { requireAdmin } from "@/utils/api-auth";
import { logRequest } from "@/lib/nim";
import { ingestScholarship, type ScholarshipIngestRecord } from "@/lib/rag-ingest";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY is not configured" }, { status: 500 });

  let ids: string[] | null = null;
  try {
    const body = await req.json();
    if (Array.isArray(body?.ids)) ids = body.ids;
  } catch { /* no body is fine */ }

  const scholarships = ids && ids.length > 0
    ? await sql`
        SELECT id, title, country, degree_level, funding_type, deadline, is_live, opening_note,
               official_url, competitiveness, eligibility_summary, slug, raw_description,
               ai_summary, tips, tags, required_documents
        FROM scholarships
        WHERE status = 'published' AND id = ANY(${ids}::uuid[])
      `
    : await sql`
        SELECT id, title, country, degree_level, funding_type, deadline, is_live, opening_note,
               official_url, competitiveness, eligibility_summary, slug, raw_description,
               ai_summary, tips, tags, required_documents
        FROM scholarships
        WHERE status = 'published'
      `;

  if (!scholarships.length) {
    return NextResponse.json({ message: "No published scholarships to ingest", results: [] });
  }

  const results: { id: string; title: string; chunks: number; error?: string }[] = [];

  for (const s of scholarships as ScholarshipIngestRecord[]) {
    logRequest("rag.ingest.batch.start", { scholarshipId: s.id, title: s.title });
    const result = await ingestScholarship(s, apiKey);
    results.push({ ...result, title: s.title });
    logRequest("rag.ingest.batch.done", {
      scholarshipId: s.id,
      chunks: result.chunks,
      error: result.error ?? "",
    });
  }

  const succeeded = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;

  return NextResponse.json({ succeeded, failed, results });
}

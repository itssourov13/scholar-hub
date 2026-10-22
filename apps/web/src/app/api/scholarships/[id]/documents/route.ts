import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { revalidateScholarshipPages } from "@/lib/revalidate-scholarships";
import { checkRateLimit, getClientIp } from "@/lib/nim";
import { fetchCompletion, extractJsonObject } from "@/lib/ai-completion";
import type { RequiredDocuments } from "@/lib/scholarships-db";

const SYSTEM = `You are a study-abroad application specialist advising Bangladeshi students.
Given ONE specific scholarship, list the documents an applicant most likely needs to apply.

Respond with ONLY valid JSON (no markdown fences, no prose), matching exactly:
{
  "core": string[],        // 5-8 essential documents nearly always required
  "additional": string[],  // 2-4 documents that are sometimes/conditionally required
  "note": string           // ONE short, practical tip (< 200 chars)
}

Rules:
- Tailor to the scholarship's degree level, field, country and funding type
  (e.g. research proposal for PhD, portfolio for design/architecture,
  GRE/GMAT where relevant, financial documents for partial funding).
- Be specific but do NOT invent official requirements you are unsure of; prefer
  widely-accepted, standard documents.
- Keep each item short (a document name, optionally a brief qualifier).`;

function sanitizeList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.length <= 160)
    .slice(0, max);
}

function isValidDocs(d: RequiredDocuments | null): boolean {
  return Boolean(d && d.core.length >= 3);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch the scholarship (accept slug or UUID). Only published rows.
  const rows = await sql`
    SELECT id, slug, title, country, degree_level, funding_type,
           eligibility_summary, official_url, required_documents
    FROM scholarships
    WHERE (slug = ${id} OR id::text = ${id}) AND status = 'published'
    LIMIT 1
  `;
  const s = rows[0];
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cache hit — return immediately, no AI call.
  const cached = s.required_documents as RequiredDocuments | null;
  if (isValidDocs(cached)) {
    return NextResponse.json({ documents: cached, cached: true });
  }

  // Rate-limit generation per IP to prevent abuse. Generation is a one-time
  // cost per scholarship (it's cached afterwards), so this only guards bursts.
  const ip = getClientIp(req);
  const rate = await checkRateLimit(`docs:${ip}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": Math.ceil(rate.resetMs / 1000).toString() } }
    );
  }

  const userPrompt = `
Scholarship: ${s.title}
Country: ${s.country ?? "Not specified"}
Degree level: ${s.degree_level ?? "Not specified"}
Funding type: ${s.funding_type ?? "Not specified"}
Eligibility notes: ${s.eligibility_summary ?? "Not specified"}
`.trim();

  let docs: RequiredDocuments;
  try {
    const { content } = await fetchCompletion({
      model: "deepseek",
      system: SYSTEM,
      user: userPrompt,
      maxTokens: 600,
      temperature: 0.3,
      timeoutMs: 20_000,
    });
    const parsed = extractJsonObject<Partial<RequiredDocuments>>(content);
    docs = {
      core: sanitizeList(parsed.core, 8),
      additional: sanitizeList(parsed.additional, 4),
      note: typeof parsed.note === "string" ? parsed.note.trim().slice(0, 220) : undefined,
    };
  } catch {
    // AI failed — tell the client to keep showing the generic fallback.
    return NextResponse.json({ documents: null, error: "generation_failed" }, { status: 200 });
  }

  if (!isValidDocs(docs)) {
    return NextResponse.json({ documents: null, error: "invalid_output" }, { status: 200 });
  }

  // Cache in the DB so we never regenerate for this scholarship again.
  try {
    await sql`
      UPDATE scholarships
      SET required_documents = ${JSON.stringify(docs)}::jsonb
      WHERE id = ${s.id as string}
    `;
    // Refresh the statically-cached detail page so future visits (and crawlers)
    // get the unique documents in the server-rendered HTML.
    revalidateScholarshipPages({
      slug: (s.slug as string | null) ?? null,
      id: s.id as string,
    });
  } catch {
    // If the write fails we still return the docs for this visitor.
  }

  return NextResponse.json({ documents: docs, cached: false });
}

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { requireAdmin } from "@/utils/api-auth";
import { checkRateLimit, getClientIp, logRequest } from "@/lib/nim";
import { fetchCompletion, parseJsonFromCompletion, type ModelChoice } from "@/lib/ai-completion";
import { revalidateScholarshipPages } from "@/lib/revalidate-scholarships";

const VALID_MODELS: ModelChoice[] = ["nim", "kimi", "deepseek", "mistral", "deepseek-pro", "minimax-m3", "gemini-flash"];

const ENRICH_SYSTEM = `You are a scholarship data specialist. Given raw scholarship information, you will return a structured JSON object with enriched, accurate details.

IMPORTANT: respond with ONLY valid JSON, no markdown fences, no explanation.

Required JSON shape:
{
  "eligibility_summary": "2-3 sentences on who qualifies (CGPA, degree, nationality, etc.)",
  "competitiveness": "High" | "Medium" | "Low",
  "tips": "3-5 concise bullet points (use • as bullet char) on how to apply successfully",
  "tags": ["tag1", "tag2", ...],  // 4-8 short tags (country, field, funding type, etc.)
  "ai_summary": "1-2 paragraph engaging summary of the scholarship for Bangladeshi students",
  "university_name": "The primary university or institution administering this scholarship (e.g. 'University of Oxford', 'DAAD', 'Chevening Secretariat'). Just the name, nothing else."
}`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const rate = await checkRateLimit(`admin:${auth.userId}:enrich`, { limit: 6, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      { status: 429, headers: { "Retry-After": Math.ceil(rate.resetMs / 1000).toString() } }
    );
  }

  let model: ModelChoice = "deepseek";
  try {
    const body = await req.json();
    if (VALID_MODELS.includes(body?.model)) model = body.model;
  } catch {
    // keep default
  }

  const { id } = await params;
  const rows = await sql`SELECT * FROM scholarships WHERE id = ${id} LIMIT 1`;
  const scholarship = rows[0];

  if (!scholarship) return NextResponse.json({ error: "Scholarship not found" }, { status: 404 });

  const userPrompt = `
Scholarship details to enrich:
Title: ${scholarship.title}
Country: ${scholarship.country}
Degree Level: ${scholarship.degree_level ?? "Not specified"}
Funding Type: ${scholarship.funding_type ?? "Not specified"}
Deadline: ${scholarship.deadline ?? "Not specified"}
Official URL: ${scholarship.official_url ?? "Not specified"}
Raw Description:
${scholarship.raw_description ?? "No description provided"}
`.trim();

  let raw: string;
  let modelUsed = "";
  try {
    const result = await fetchCompletion({
      model,
      system: ENRICH_SYSTEM,
      user: userPrompt,
      maxTokens: 2048,
      temperature: 0.4,
      json: true,
    });
    raw = result.content;
    modelUsed = result.modelUsed;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  logRequest("admin.enrich.complete", { ip, model: modelUsed });

  let enriched: Record<string, unknown>;
  try {
    enriched = parseJsonFromCompletion(raw);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON", raw }, { status: 422 });
  }

  const updated = await sql`
    UPDATE scholarships SET
      eligibility_summary = ${enriched.eligibility_summary as string},
      competitiveness     = ${enriched.competitiveness as string},
      tips                = ${enriched.tips as string},
      tags                = ${JSON.stringify(enriched.tags)}::jsonb,
      ai_summary          = ${enriched.ai_summary as string},
      thumbnail_prompt    = ${(enriched.university_name ?? enriched.thumbnail_prompt ?? "") as string},
      updated_at          = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  if (updated[0]) {
    revalidateScholarshipPages({
      slug: (updated[0].slug as string | null) ?? null,
      id: (updated[0].id as string) ?? id,
    });
  }

  return NextResponse.json({ scholarship: updated[0], enriched });
}

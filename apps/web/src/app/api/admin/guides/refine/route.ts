import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { requireAdmin } from "@/utils/api-auth";
import { checkRateLimit, getClientIp, logRequest } from "@/lib/nim";
import { fetchCompletion, parseJsonFromCompletion, type ModelChoice } from "@/lib/ai-completion";

const VALID_MODELS: ModelChoice[] = ["nim", "kimi", "deepseek", "mistral", "gemini-flash"];

const GUIDE_REFINE_SYSTEM = `You are an expert content editor for ScholarHub, a study-abroad guidance platform for Bangladeshi students.

The admin will give you a rough draft — notes, bullet points, or prose — about a higher study topic (scholarships, IELTS, SOP, visa, specific countries, etc.).

Your job: turn it into a polished, SEO-optimised guide with TWO distinct sections:
  1. A full blog post / article body (the "content" field) — narrative and informative
  2. A structured FAQ section (the "faqs" field) — question-and-answer format

LANGUAGE: Write ALL content (title, description, intro, content body, all FAQ questions and answers) in Bengali (বাংলা). Only the slug and tags should remain in English (lowercase, URL-safe).

CRITICAL: Respond with ONLY valid JSON, no markdown fences, no explanation.

Required JSON shape:
{
  "slug": "url-safe-slug",
  "title": "Full SEO title in Bengali",
  "description": "Meta description in Bengali (≤ 155 chars)",
  "category": "Scholarships | Applications | Tests | Destinations | Visa",
  "tags": ["tag1", "tag2"],
  "intro": "2–3 sentence intro in Bengali.",
  "content": "Full article body in Bengali with Markdown headings (## Section). 5–7 paragraphs of real prose.",
  "faqs": [
    { "question": "Question in Bengali?", "answer": "Full answer in Bengali." }
  ]
}`;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const rate = await checkRateLimit(`admin:${auth.userId}:guide-refine`, { limit: 10, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      { status: 429, headers: { "Retry-After": Math.ceil(rate.resetMs / 1000).toString() } }
    );
  }

  let body: { draft?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const draft = body.draft?.trim();
  if (!draft || draft.length < 30) {
    return NextResponse.json({ error: "draft must be at least 30 characters" }, { status: 400 });
  }

  const model: ModelChoice = VALID_MODELS.includes(body.model as ModelChoice)
    ? (body.model as ModelChoice)
    : "deepseek";

  let content: string;
  let modelUsed: string;
  try {
    const result = await fetchCompletion({
      model,
      system: GUIDE_REFINE_SYSTEM,
      user: `Admin's rough draft:\n\n${draft}`,
      maxTokens: 5000,
      temperature: 0.4,
    });
    content = result.content;
    modelUsed = result.modelUsed;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  logRequest("admin.guide.refine.complete", { ip, model: modelUsed });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonFromCompletion(content);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON", raw: content }, { status: 422 });
  }

  if (!parsed.slug || !parsed.title || !parsed.content || !Array.isArray(parsed.faqs)) {
    return NextResponse.json({ error: "AI response missing required fields", raw: parsed }, { status: 422 });
  }

  const baseSlug = String(parsed.slug);
  let finalSlug = baseSlug;
  let attempt = 1;
  while (true) {
    const rows = await sql`SELECT id FROM guides WHERE slug = ${finalSlug} LIMIT 1`;
    if (!rows[0]) break;
    attempt++;
    finalSlug = `${baseSlug}-${attempt}`;
  }
  parsed.slug = finalSlug;

  return NextResponse.json({ parsed, meta: { modelUsed } });
}

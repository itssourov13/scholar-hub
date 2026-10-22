import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { requireAdmin } from "@/utils/api-auth";
import { checkRateLimit, getClientIp, logRequest } from "@/lib/nim";
import { fetchCompletion, type ModelChoice } from "@/lib/ai-completion";
import { SITE_URL } from "@/lib/site-config";

const BASE_URL = SITE_URL;

const VALID_MODELS: ModelChoice[] = ["nim", "kimi", "deepseek", "mistral", "gemini-flash"];

const TELEGRAM_SYSTEM = `তুমি একজন বাংলাদেশী scholarship information specialist। তোমার কাজ হলো একটি আকর্ষণীয় Telegram channel post লেখা যা বাংলাদেশী students দের scholarship apply করতে উৎসাহিত করবে।

STRICT RULES:
- বাংলায় লিখবে, কিন্তু scholarship নাম, university নাম, দেশের নাম, degree level (BSc, MSc, PhD), funding type (fully funded, partial) ইত্যাদি technical/proper noun গুলো English-এ রাখবে
- Post টি ১৫০-২২০ words এর মধ্যে রাখবে
- NEVER use any markdown syntax — no **, no *, no _, no #, no backticks. Plain text only.
- Structure ও emphasis এর জন্য শুধু emojis ব্যবহার করবে (যেমন 🎓 📅 ✅ 💰 🌍 👇)
- শেষে একটি clear call-to-action এবং scholarship link দেবে
- Tone হবে exciting, urgent কিন্তু informative
- Post টি সরাসরি দাও, কোনো introduction বা explanation ছাড়া`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const rate = await checkRateLimit(`admin:${auth.userId}:telegram`, { limit: 20, windowMs: 10 * 60_000 });
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
  const s = rows[0];

  if (!s) return NextResponse.json({ error: "Scholarship not found" }, { status: 404 });

  const slug = (s.slug as string | null) ?? (s.id as string);
  const scholarshipUrl = `${BASE_URL}/scholarships/${slug}`;

  const deadlineText = s.deadline
    ? `Deadline: ${s.deadline}`
    : "Deadline: Rolling / check official site";

  const userPrompt = `
নিচের scholarship এর জন্য একটি আকর্ষণীয় Telegram post লেখো:

Scholarship Name: ${s.title}
Country: ${s.country}
Degree Level: ${s.degree_level ?? "Not specified"}
Funding Type: ${s.funding_type ?? "Not specified"}
${deadlineText}
Eligibility Summary: ${s.eligibility_summary ?? ""}
AI Summary: ${s.ai_summary ?? ""}
Tags: ${Array.isArray(s.tags) ? (s.tags as string[]).join(", ") : String(s.tags ?? "")}

Scholarship Link: ${scholarshipUrl}

Post টি এমনভাবে লেখো যাতে বাংলাদেশী students সাথে সাথে link টি visit করতে চায়।
`.trim();

  let content: string;
  let modelUsed = "";
  try {
    const result = await fetchCompletion({
      model,
      system: TELEGRAM_SYSTEM,
      user: userPrompt,
      maxTokens: 512,
      temperature: 0.75,
    });
    content = result.content.trim();
    modelUsed = result.modelUsed;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  logRequest("admin.telegram.generate", { ip, model: modelUsed });

  return NextResponse.json({ text: content, url: scholarshipUrl });
}

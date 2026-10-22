import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/api-auth";
import { checkRateLimit, getClientIp, logRequest } from "@/lib/nim";
import { fetchCompletion, type ModelChoice } from "@/lib/ai-completion";

const VALID_MODELS: ModelChoice[] = ["nim", "kimi", "deepseek", "mistral", "gemini-flash"];

const THUMBNAIL_PROMPT_SYSTEM = `You are an art director who writes prompts for AI image generators (DALL·E, Midjourney, Stable Diffusion).

Given the metadata of a study-abroad guide article, write ONE vivid, self-contained image-generation prompt for a 1200×630 landscape cover thumbnail.

Rules:
- Output ONLY the prompt text — no preamble, no quotes, no markdown, no explanation.
- Write the prompt in English even if the guide is in another language.
- Make it visually concrete and contextual to the guide's topic (country, scholarships, documents, tests, etc.).
- Specify: subject/scene, style (clean modern editorial illustration or photographic), color mood, composition, and "leave clear negative space for a title overlay".
- Keep it under 80 words. Avoid any real logos, trademarks, or readable text in the image.`;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const rate = await checkRateLimit(`admin:${auth.userId}:guide-thumb-prompt`, {
    limit: 20,
    windowMs: 10 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      { status: 429, headers: { "Retry-After": Math.ceil(rate.resetMs / 1000).toString() } },
    );
  }

  let body: { title?: string; category?: string; intro?: string; content?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const model: ModelChoice = VALID_MODELS.includes(body.model as ModelChoice)
    ? (body.model as ModelChoice)
    : "deepseek";

  const userMsg = [
    `Title: ${title}`,
    body.category ? `Category: ${body.category}` : "",
    body.intro ? `Intro: ${body.intro}` : "",
    body.content ? `Excerpt: ${body.content.slice(0, 600)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { content, modelUsed } = await fetchCompletion({
      model,
      system: THUMBNAIL_PROMPT_SYSTEM,
      user: userMsg,
      maxTokens: 300,
      temperature: 0.8,
    });

    const prompt = content
      .replace(/^```[a-z]*\s*/i, "")
      .replace(/```\s*$/i, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    if (!prompt) {
      return NextResponse.json({ error: "AI returned an empty prompt." }, { status: 422 });
    }

    logRequest("admin.guide.thumbnail_prompt.complete", { ip, model: modelUsed });
    return NextResponse.json({ prompt, meta: { modelUsed } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

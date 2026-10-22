/**
 * AI-powered academic CV analysis.
 *
 * Uses OpenRouter's `deepseek/deepseek-v4-pro` and `z-ai/glm-5.2` in JSON mode
 * with reasoning disabled, to review an uploaded CV and return structured,
 * actionable feedback. The result is designed to gently push students toward
 * building a fresh, well-structured CV with our builder.
 */

import { fetchCompletion, parseJsonFromCompletion, extractJsonObject } from "@/lib/ai-completion";
import type { ModelChoice } from "@/lib/model-options";

export type SectionFeedback = {
  name: string;
  rating: "strong" | "adequate" | "needs-work" | "missing";
  feedback: string;
  suggestions: string[];
};

export type CVAnalysis = {
  overallScore: number; // 0–100
  summary: string;
  strengths: string[];
  weaknesses: string[];
  sections: SectionFeedback[];
  missingSections: string[];
  actionItems: string[];
};

const SYSTEM_PROMPT = `You are an expert academic career advisor and admissions consultant who has reviewed thousands of CVs for graduate school (Masters/PhD), scholarships, and research positions. You specialise in helping Bangladeshi and international students craft competitive academic CVs.

You will be given the raw extracted text of a student's current CV. Analyse it critically but constructively for use in academic and scholarship applications.

Judge it against the standards of a strong ACADEMIC CV, which typically includes: Contact information, Research Interests / Objective, Education, Research Experience, Publications, Teaching Experience, Awards & Honours, Conference Presentations, Technical/Language Skills, and References.

Return ONLY a single JSON object (no markdown, no prose, no code fences) with EXACTLY this shape:
{
  "overallScore": <integer 0-100>,
  "summary": "<2-3 sentence overall verdict>",
  "strengths": ["<concrete strength>", ...],
  "weaknesses": ["<concrete weakness>", ...],
  "sections": [
    {
      "name": "<section name, e.g. Education>",
      "rating": "strong" | "adequate" | "needs-work" | "missing",
      "feedback": "<1-2 sentence assessment>",
      "suggestions": ["<specific, actionable improvement>", ...]
    }
  ],
  "missingSections": ["<section that should be added>", ...],
  "actionItems": ["<prioritised, specific next step>", ...]
}

Rules:
- Be specific and reference the actual content where possible; avoid generic filler.
- Score strictly: a typical student CV that lacks research framing should score 40-65.
- Provide 3-5 strengths, 3-5 weaknesses, 4-6 actionItems.
- In "sections", cover only the 6-8 most decision-relevant sections, with at most
  2 suggestions each. Sections that are simply absent belong in "missingSections"
  rather than getting their own "sections" entry.
- Keep every string under 200 characters. Be terse — no preamble, no repetition.
- Output valid JSON only.`;

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normalizeAnalysis(raw: Record<string, unknown>): CVAnalysis {
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const sections = Array.isArray(raw.sections)
    ? (raw.sections as Record<string, unknown>[]).map((s) => {
        const rating = String(s.rating ?? "adequate");
        const allowed = ["strong", "adequate", "needs-work", "missing"];
        return {
          name: String(s.name ?? "Section"),
          rating: (allowed.includes(rating) ? rating : "adequate") as SectionFeedback["rating"],
          feedback: String(s.feedback ?? ""),
          suggestions: strArr(s.suggestions),
        };
      })
    : [];

  return {
    overallScore: clampScore(raw.overallScore),
    summary: String(raw.summary ?? ""),
    strengths: strArr(raw.strengths),
    weaknesses: strArr(raw.weaknesses),
    sections,
    missingSections: strArr(raw.missingSections),
    actionItems: strArr(raw.actionItems),
  };
}

function parseAnalysis(content: string, modelUsed: string): Record<string, unknown> {
  try {
    return parseJsonFromCompletion<Record<string, unknown>>(content);
  } catch {
    try {
      return extractJsonObject<Record<string, unknown>>(content);
    } catch (err) {
      // Surface a preview so failures are debuggable from logs instead of
      // just "analysis failed" — most commonly caused by the response
      // getting cut off before the model finished writing the JSON.
      const preview = content.slice(0, 300);
      throw new Error(
        `Failed to parse CV analysis JSON from ${modelUsed} (content length ${content.length}): ${
          (err as Error).message
        }. Preview: ${preview}`,
      );
    }
  }
}

/**
 * deepseek-v4-pro gives the best critique but its latency is erratic —
 * measured runs on the same prompt ranged from 26s to over 40s. Running it
 * one-at-a-time before falling back used to mean a slow spell cost 24s + 20s
 * = 44s before the student saw anything.
 *
 * These two are raced concurrently instead: whichever returns usable JSON
 * first wins, and total wall time is bounded by the *slower* timeout (~22s)
 * rather than their sum. glm-5.2 — not deepseek-v4-flash — is the race
 * partner on purpose: flash is noticeably worse at this specific task (this
 * prompt asks for a lot of structured, opinionated critique, and flash-tier
 * models tend to either shortcut it or emit invalid JSON under that load), so
 * racing it against pro would let a weaker result win just by finishing
 * first. glm-5.2 is full-size, comparable quality, and — being a different
 * vendor entirely — also fails independently of an OpenRouter/deepseek-side
 * outage, which is the failure mode actually observed in production.
 */
const RACE_ATTEMPTS: { model: ModelChoice; timeoutMs: number }[] = [
  { model: "deepseek-pro", timeoutMs: 22_000 },
  { model: "glm", timeoutMs: 18_000 },
];

/**
 * Only reached when *both* raced attempts fail — almost always a genuine
 * OpenRouter/deepseek outage rather than one model being unlucky. gpt-4o-mini
 * sits on entirely different infra and is well tested at sticking to a strict
 * JSON schema, so it's a real safety net rather than another shot at the same
 * failure. 16s keeps the worst case (22s race + 16s fallback ≈ 38s) well
 * inside the route's maxDuration=60, leaving headroom for PDF extraction,
 * auth and the DB insert.
 */
const FALLBACK_ATTEMPT: { model: ModelChoice; timeoutMs: number } = {
  model: "gpt4o-mini",
  timeoutMs: 16_000,
};

async function runAttempt(
  attempt: { model: ModelChoice; timeoutMs: number },
  trimmed: string,
): Promise<{ analysis: CVAnalysis; modelUsed: string }> {
  const { content, modelUsed } = await fetchCompletion({
    model: attempt.model,
    system: SYSTEM_PROMPT,
    user: `Here is the extracted text of the CV to analyse:\n\n"""\n${trimmed}\n"""`,
    // Reasoning stays off. These are reasoning-capable models that otherwise
    // spend 15-35s on invisible thinking tokens before answering, and those
    // tokens also eat the maxTokens budget, truncating the JSON. Reasoning
    // adds little to structured extraction. 4000 is ample.
    maxTokens: 4000,
    temperature: 0.3,
    timeoutMs: attempt.timeoutMs,
    reasoning: { enabled: false },
    // Provider-enforced valid JSON. Without it models intermittently emit
    // *almost*-valid JSON that no lenient client-side parse can recover.
    json: true,
  });
  return { analysis: normalizeAnalysis(parseAnalysis(content, modelUsed)), modelUsed };
}

/** Analyse extracted CV text and return structured feedback. */
export async function analyzeCVText(
  cvText: string,
): Promise<{ analysis: CVAnalysis; modelUsed: string }> {
  const trimmed = cvText.slice(0, 16000); // keep prompt within budget

  try {
    return await Promise.any(RACE_ATTEMPTS.map((attempt) => runAttempt(attempt, trimmed)));
  } catch (raceError) {
    // Promise.any only throws once every entry has rejected — log each reason
    // (timeout, upstream error, or unparseable JSON) before trying the
    // cross-provider fallback.
    const reasons = raceError instanceof AggregateError ? raceError.errors : [raceError];
    for (const reason of reasons) {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      console.warn("CV analysis race attempt failed:", err.message);
    }
  }

  try {
    return await runAttempt(FALLBACK_ATTEMPT, trimmed);
  } catch (err) {
    const lastError = err instanceof Error ? err : new Error(String(err));
    console.warn(`CV analysis fallback attempt with ${FALLBACK_ATTEMPT.model} failed:`, lastError.message);
    throw lastError;
  }
}

/**
 * Unified non-streaming chat completion across providers, used by admin
 * tools (parse / enrich). The user-facing chat uses the streaming helpers
 * in openrouter.ts; this is for one-shot JSON extraction tasks.
 *
 * Supported model choices:
 *   "nim"          → NVIDIA NIM (NIM_MODEL env, e.g. minimax/gemma)
 *   "kimi"         → NVIDIA NIM, explicitly minimaxai/minimax-m3
 *   "deepseek"     → OpenRouter deepseek/deepseek-v4-flash
 *   "mimo"         → OpenRouter xiaomi/mimo-v2.5
 *   "mistral"      → OpenRouter mistralai/ministral-3b-2512
 *   "deepseek-pro" → OpenRouter deepseek/deepseek-v4-pro (+ web search plugin)
 *   "minimax-m3"   → OpenRouter minimax/minimax-m3 (+ web search plugin)
 *   "gemini-flash" → OpenRouter google/gemini-3.7-flash
 *   "glm"          → OpenRouter z-ai/glm-5.2
 *   "gpt4o-mini"   → OpenRouter openai/gpt-4o-mini
 */

import { logRequest } from "@/lib/nim";
import type { ModelChoice } from "@/lib/model-options";
import { WEB_SEARCH_MODELS } from "@/lib/model-options";

export type { ModelChoice } from "@/lib/model-options";
export { MODEL_OPTIONS } from "@/lib/model-options";

const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type Message = { role: string; content: string };

type CompletionOpts = {
  model: ModelChoice;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Enable OpenRouter's web-search grounding plugin (Exa-powered). Only
   * meaningful for models in WEB_SEARCH_MODELS; ignored otherwise. */
  webSearch?: boolean;
  webSearchMaxResults?: number;
  /** Abort the upstream request if it hasn't responded within this many ms.
   * Unset = no client-side timeout (rely on the platform's own limits). */
  timeoutMs?: number;
  /** Many OpenRouter models (e.g. deepseek-v4-pro) are "reasoning" models
   * that, by default, spend 15-35s generating invisible thinking tokens
   * before writing the actual answer. Unset = leave the model's own default
   * in place. Pass `{ enabled: false }` only when a caller has measured that
   * reasoning hurts that specific task (chat latency, CV JSON truncation).
   * Use `exclude: true` to still reason but keep the trace out of `content`. */
  reasoning?: {
    enabled?: boolean;
    effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
    exclude?: boolean;
  };
  /** Ask the provider to constrain output to a valid JSON object
   * (`response_format: json_object`). Every OpenRouter model we use supports
   * it. Without this, models routinely emit *almost*-valid JSON — a trailing
   * comma or unescaped quote inside an array — which no amount of lenient
   * client-side parsing can recover. Ignored for NIM. */
  json?: boolean;
};

type CompletionResult = {
  content: string;
  modelUsed: string;
  /** Web search source citations, present when webSearch was used and the
   * model actually grounded its answer in search results. */
  citations?: { url: string; title?: string }[];
};

const resolveOpenRouterModel = (choice: ModelChoice): string => {
  if (choice === "deepseek") {
    return process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
  }
  if (choice === "deepseek-pro") return "deepseek/deepseek-v4-pro";
  if (choice === "minimax-m3") return "minimax/minimax-m3";
  if (choice === "mimo") return "xiaomi/mimo-v2.5";
  if (choice === "gemini-flash") return "google/gemini-3.7-flash";
  if (choice === "glm") return "z-ai/glm-5.2";
  if (choice === "gpt4o-mini") return "openai/gpt-4o-mini";
  // Pinned rather than read from OPENROUTER_FALLBACK_MODEL: that env now points
  // at MiMo, and an admin picking "Mistral AI" in the dropdown should get
  // Mistral. Pick "mimo" explicitly for MiMo.
  return "mistralai/ministral-3b-2512";
};

type OpenRouterCall = {
  messages: Message[];
  model: string;
  maxTokens: number;
  temperature: number;
  webSearch?: { maxResults: number };
  timeoutMs?: number;
  reasoning?: CompletionOpts["reasoning"];
  json?: boolean;
};

const callOpenRouter = async ({
  messages,
  model,
  maxTokens,
  temperature,
  webSearch,
  timeoutMs,
  reasoning,
  json,
}: OpenRouterCall): Promise<{ content: string; citations?: { url: string; title?: string }[] }> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (process.env.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  if (process.env.OPENROUTER_APP_NAME) headers["X-Title"] = process.env.OPENROUTER_APP_NAME;

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: false,
  };
  if (webSearch) {
    body.plugins = [{ id: "web", max_results: webSearch.maxResults }];
  }
  if (reasoning) {
    body.reasoning = reasoning;
  }
  if (json) {
    body.response_format = { type: "json_object" };
  }

  const controller = timeoutMs ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  // The timer must stay armed until the body is fully read, not just until
  // headers arrive: OpenRouter sends headers early and then holds the
  // connection open while the model generates, so clearing the timeout after
  // `fetch()` resolves left `res.json()` completely unbounded. That let slow
  // models run for minutes and get killed by Vercel's function limit instead
  // of failing fast here.
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller?.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter error (${res.status}) for ${model}: ${text}`);
    }

    type Annotation = { type: string; url_citation?: { url: string; title?: string } };
    const data = (await res.json()) as {
      choices?: { message?: { content?: unknown; annotations?: Annotation[] } }[];
    };
    const message = data?.choices?.[0]?.message;
    const citations = message?.annotations
      ?.filter((a) => a.type === "url_citation" && a.url_citation)
      .map((a) => ({ url: a.url_citation!.url, title: a.url_citation!.title }));
    return { content: contentToString(message?.content), citations: citations?.length ? citations : undefined };
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw new Error(`OpenRouter request to ${model} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const callNim = async (
  messages: Message[],
  maxTokens: number,
  temperature: number,
  explicitModel?: string,
): Promise<{ content: string; model: string }> => {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured.");

  const models = explicitModel
    ? [explicitModel]
    : [
        process.env.NIM_MODEL ?? "minimaxai/minimax-m3",
        process.env.NIM_FALLBACK_MODEL,
      ].filter((m): m is string => Boolean(m));

  let lastError: Error | null = null;
  for (const model of models) {
    try {
      const res = await fetch(NIM_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, stream: false }),
      });
      if (!res.ok) {
        lastError = new Error(`NIM error (${res.status}) for ${model}: ${await res.text()}`);
        continue;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
      return { content: contentToString(data?.choices?.[0]?.message?.content), model };
    } catch (err) {
      lastError = new Error(`NIM network error for ${model}: ${String(err)}`);
    }
  }
  throw lastError ?? new Error("NIM request failed");
};

export const fetchCompletion = async (opts: CompletionOpts): Promise<CompletionResult> => {
  const {
    model,
    system,
    user,
    maxTokens = 1024,
    temperature = 0.2,
    webSearch,
    webSearchMaxResults = 5,
    timeoutMs,
    reasoning,
    json,
  } = opts;
  const messages: Message[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  if (model === "nim") {
    const { content, model: modelUsed } = await callNim(messages, maxTokens, temperature);
    logRequest("ai.completion", { provider: "nim", model: modelUsed });
    return { content, modelUsed };
  }

  if (model === "kimi") {
    const { content, model: modelUsed } = await callNim(messages, maxTokens, temperature, "minimaxai/minimax-m3");
    logRequest("ai.completion", { provider: "nim", model: modelUsed });
    return { content, modelUsed };
  }

  const orModel = resolveOpenRouterModel(model);
  const useWebSearch = Boolean(webSearch) && WEB_SEARCH_MODELS.includes(model);
  const { content, citations } = await callOpenRouter({
    messages,
    model: orModel,
    maxTokens,
    temperature,
    webSearch: useWebSearch ? { maxResults: webSearchMaxResults } : undefined,
    timeoutMs,
    reasoning,
    json,
  });
  logRequest("ai.completion", { provider: "openrouter", model: orModel, webSearch: useWebSearch });
  return { content, modelUsed: orModel, citations };
};

/** OpenRouter sometimes returns message.content as a string, sometimes as
 * an array of `{ type, text }` parts. Downstream parsers assume a string. */
const contentToString = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  return "";
};

/** Strip reasoning-model wrappers that some providers leak into `content`
 * even when the actual JSON follows afterwards. */
const stripReasoningWrappers = (raw: string): string =>
  raw
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, "")
    .trim();

const stripJsonFences = (raw: string): string =>
  raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

/**
 * Parse JSON from a model response. Strips thinking wrappers and markdown
 * fences first; if the remainder still isn't a bare object, extracts the
 * outermost `{...}` (models sometimes add a sentence around the JSON).
 * Throws if nothing parseable remains — most commonly a response truncated
 * mid-object by the token budget.
 */
export const parseJsonFromCompletion = <T = Record<string, unknown>>(raw: string): T => {
  const cleaned = stripJsonFences(stripReasoningWrappers(String(raw ?? "")));
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return extractJsonObject<T>(cleaned);
  }
};

/**
 * Lenient fallback for parseJsonFromCompletion: extracts the outermost
 * `{...}` block from a response that may have stray prose/preamble around
 * it (web-search-grounded models sometimes add a sentence before/after the
 * JSON despite instructions not to). Throws if no balanced object is found
 * or it still doesn't parse — most commonly because the response was
 * truncated mid-object by the token budget, which callers should treat as
 * a signal to retry with a larger maxTokens.
 */
export const extractJsonObject = <T = Record<string, unknown>>(raw: string): T => {
  const text = stripJsonFences(stripReasoningWrappers(String(raw ?? "")));
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in response");
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
};

import { logRequest } from "@/lib/nim";

export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

type OpenRouterMessage = { role: string; content: string | OpenRouterContentPart[] };

type OpenRouterPayload = {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  reasoning?: { enabled?: boolean; effort?: string; exclude?: boolean };
  /** PDF parsing. Pin `cloudflare-ai` so OpenRouter never bills Mistral OCR. */
  plugins?: Array<{ id: string; pdf?: { engine: string } }>;
};

/** Free text extraction for PDFs. Do not omit this — the default engine can be paid OCR. */
export const OPENROUTER_FREE_PDF_PLUGIN = {
  id: "file-parser",
  pdf: { engine: "cloudflare-ai" },
} as const;

type OpenRouterFetchResult = {
  response: Response;
  model: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Bounds only the wait for OpenRouter to *start* responding (headers/first
// byte) — cleared as soon as `fetch()` resolves, so it never cuts off an
// already-streaming reply. If the primary model hasn't even begun answering
// within this window, it's faster to fail over than to keep waiting.
const CONNECT_TIMEOUT_MS = 15_000;

/**
 * Chat model chain. Text turns try DeepSeek V4 Flash first, then Gemini.
 * Attachment turns skip both — DeepSeek is text-only, and Gemini vision/file
 * tokens are expensive enough to burn the free-tier budget. Photos and PDFs
 * go to GPT-5.6 Luna only (`OPENROUTER_VISION_MODEL`).
 */
export function getOpenRouterChatModels(opts?: { multimodal?: boolean }): string[] {
  const primary = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
  // Gemini Flash is fast and on different infra than DeepSeek, so a DeepSeek
  // outage does not take text chat down. It is never used for attachments.
  const fallback = process.env.OPENROUTER_FALLBACK_MODEL ?? "google/gemini-3.7-flash";
  if (opts?.multimodal) {
    const vision = process.env.OPENROUTER_VISION_MODEL?.trim() || "openai/gpt-5.6-luna";
    return [vision];
  }
  return Array.from(new Set([primary, fallback].filter((value): value is string => Boolean(value))));
}

const buildHeaders = (apiKey: string, accept: string): HeadersInit => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: accept,
  };

  // Optional but recommended attribution headers (used by OpenRouter for analytics
  // and may grant slight priority on shared free models).
  const referer = process.env.OPENROUTER_SITE_URL;
  const title = process.env.OPENROUTER_APP_NAME;
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;

  return headers;
};

/**
 * Streams a chat completion from OpenRouter, trying the primary model first
 * and falling back to the configured fallback model on failure.
 * The returned Response body is an SSE stream in the OpenAI format —
 * compatible with the same parser used previously for NVIDIA NIM.
 */
export const fetchOpenRouterChatWithFallback = async (
  payload: Omit<OpenRouterPayload, "model">,
  options: { apiKey: string; accept: string; models?: string[] },
): Promise<OpenRouterFetchResult> => {
  const models = options.models ?? getOpenRouterChatModels();
  if (models.length === 0) {
    throw new Error("No OpenRouter models configured");
  }
  let lastError: Error | null = null;

  for (const model of models) {
    const requestBody: OpenRouterPayload = { ...payload, model };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: buildHeaders(options.apiKey, options.accept),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text();
        const err = new Error(
          `OpenRouter error (${response.status}) for ${model}: ${text}`,
        );
        logRequest("openrouter.fallback", { model, status: response.status });
        lastError = err;
        continue;
      }

      return { response, model };
    } catch (error) {
      clearTimeout(timer);
      const timedOut = error instanceof Error && error.name === "AbortError";
      lastError = timedOut
        ? new Error(`OpenRouter request to ${model} did not respond within ${CONNECT_TIMEOUT_MS}ms`)
        : new Error(`OpenRouter network error for ${model}: ${String(error)}`);
      logRequest(timedOut ? "openrouter.connect_timeout" : "openrouter.network_error", {
        model,
        error: String(error),
      });
    }
  }

  throw lastError ?? new Error("OpenRouter request failed");
};

/**
 * Turn a raw model id (e.g. "deepseek/deepseek-v4-flash") into a friendly
 * user-facing label (e.g. "Deepseek V4"). Unknown models fall back to a
 * generic prettifier so we never display a raw, ugly identifier in the UI.
 */

// Curated overrides for the models we actually use. Add to this map as you
// onboard new providers.
const KNOWN_MODELS: Record<string, string> = {
  "deepseek/deepseek-v4-flash": "Deepseek V4",
  "deepseek/deepseek-v4-pro": "Deepseek V4",
  "xiaomi/mimo-v2.5": "MiMo V2.5",
  "xiaomi/mimo-v2.5-pro": "MiMo V2.5 Pro",
  "mistralai/ministral-3b-2512": "Mistral AI",
  "mistralai/ministral-8b-2410": "Mistral AI",
  "minimaxai/minimax-m3": "MiniMax M3",
  "google/gemma-4-31b-it": "Gemma 4",
  "google/gemini-3.7-flash": "Gemini 3.7",
  "google/gemini-2.5-flash": "Gemini 2.5",
  "google/gemini-2.5-flash-lite": "Gemini 2.5 Lite",
  "meta-llama/llama-3.3-70b-instruct": "Llama 3.3",
  "meta-llama/llama-3.1-8b-instruct": "Llama 3.1",
  "anthropic/claude-sonnet-4.5": "Claude Sonnet",
  "anthropic/claude-haiku-4": "Claude Haiku",
  "openai/gpt-4o-mini": "GPT-4o",
  "openai/gpt-5-mini": "GPT-5",
  "openai/gpt-5.6-luna": "GPT-5.6 Luna",
  "nvidia/nv-embedqa-e5-v5": "NVIDIA Embed",
  "nvidia/llama-nemotron-embed-1b-v2": "NVIDIA Embed",
  "nvidia/nemotron-3-embed-1b": "NVIDIA Embed",
  "nvidia/nemotron-3-embed-1b:free": "NVIDIA Embed",
};

const PROVIDER_BRAND: Record<string, string> = {
  deepseek: "Deepseek",
  mistralai: "Mistral AI",
  moonshotai: "Moonshot",
  google: "Google",
  "meta-llama": "Meta Llama",
  meta: "Meta",
  anthropic: "Anthropic",
  openai: "OpenAI",
  nvidia: "NVIDIA",
  qwen: "Qwen",
  alibaba: "Qwen",
  xiaomi: "MiMo",
  minimax: "MiniMax",
  minimaxai: "MiniMax",
};

/**
 * Generic prettifier for any model id. Examples:
 *   "deepseek/deepseek-v4-flash" → "Deepseek V4"
 *   "mistralai/ministral-3b-2512" → "Mistral AI"
 *   "qwen/qwen2.5-72b-instruct"   → "Qwen 2.5"
 */
const genericPrettify = (modelId: string): string => {
  const [providerRaw = "", nameRaw = modelId] = modelId.split("/", 2);
  const provider = providerRaw.toLowerCase();
  const name = nameRaw.toLowerCase();

  const brand = PROVIDER_BRAND[provider] ?? capitalize(provider);

  // Try to extract a meaningful version token. We drop common size/quantization
  // tokens and leave behind a clean "v4", "3.3", "4o", etc.
  const tokens = name
    .replace(/^(?:deepseek|gemma|gemini|llama|kimi|gpt|claude|qwen|mistral|ministral|nemotron|nv|embed)[-_]?/, "")
    .split(/[-_.]/)
    .filter(Boolean);

  const isSizeToken = (t: string) =>
    /^\d+(\.\d+)?b$/.test(t) || // 8b, 70b, 3.5b
    /^\d{3,4}$/.test(t) ||      // dated suffixes like 2410, 2512
    ["instruct", "chat", "it", "free", "preview", "flash", "lite", "mini", "pro", "max", "xs", "xl"].includes(t);

  const versionToken = tokens.find((t) => /^v?\d/.test(t) && !isSizeToken(t));

  if (versionToken) {
    return `${brand} ${versionToken.toUpperCase().replace(/^V/, "V")}`.trim();
  }

  // No version found — just use the brand.
  return brand;
};

const capitalize = (s: string) =>
  s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);

export const formatModelLabel = (modelId: string | null | undefined): string => {
  if (!modelId) return "";
  const known = KNOWN_MODELS[modelId];
  if (known) return known;
  return genericPrettify(modelId);
};

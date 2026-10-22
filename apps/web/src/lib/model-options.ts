/**
 * AI model choices and their display labels.
 * This file is intentionally free of server-side imports so it can be
 * safely used by both server code (api routes) and client components.
 */

export type ModelChoice =
  | "nim"
  | "kimi"
  | "deepseek"
  | "mistral"
  | "mimo"
  | "deepseek-pro"
  | "minimax-m3"
  | "gemini-flash"
  | "glm"
  | "gpt4o-mini";

export const MODEL_OPTIONS: { value: ModelChoice; label: string }[] = [
  { value: "deepseek", label: "Deepseek V4 (best quality)" },
  { value: "mimo", label: "MiMo V2.5 (fast, cheap, 1M context)" },
  { value: "mistral", label: "Mistral AI (fast, cheap)" },
  { value: "nim", label: "NVIDIA NIM (env model)" },
  { value: "kimi", label: "MiniMax M3 (NIM)" },
  { value: "deepseek-pro", label: "Deepseek V4 Pro + Web Search (experimental)" },
  { value: "minimax-m3", label: "MiniMax M3 + Web Search (experimental)" },
  { value: "gemini-flash", label: "Gemini 3.7 Flash (fast, cheap)" },
  { value: "glm", label: "GLM 5.2 (fast, cheap)" },
  { value: "gpt4o-mini", label: "GPT-4o mini (fast, reliable JSON)" },
];

/** Models that support OpenRouter's web-search grounding plugin. */
export const WEB_SEARCH_MODELS: ModelChoice[] = ["deepseek-pro", "minimax-m3"];

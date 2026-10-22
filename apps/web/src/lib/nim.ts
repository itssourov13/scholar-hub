import Redis from "ioredis";

type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

type NimFetchResult = {
  response: Response;
  model: string;
};

type NimChatPayload = {
  model: string;
  messages: { role: string; content: string }[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  chat_template_kwargs?: Record<string, unknown>;
};

const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_EMBEDDING_URL = "https://openrouter.ai/api/v1/embeddings";
const REDIS_PREFIX = process.env.REDIS_PREFIX ?? "bp";

const rateLimitLua = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {current, ttl}
`;

const globalRateLimit = (() => {
  const globalScope = globalThis as typeof globalThis & {
    __bpRateLimit?: Map<string, RateLimitState>;
    __bpRedis?: Redis | null;
  };
  if (!globalScope.__bpRateLimit) {
    globalScope.__bpRateLimit = new Map();
  }
  return globalScope.__bpRateLimit;
})();

const getRedis = (): Redis | null => {
  const redisUrl = process.env.REDIS_URL;
  const globalScope = globalThis as typeof globalThis & {
    __bpRedis?: Redis | null;
  };

  if (!redisUrl) {
    globalScope.__bpRedis = null;
    return null;
  }

  if (!globalScope.__bpRedis) {
    globalScope.__bpRedis = new Redis(redisUrl, {
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
      // Railway private networking is IPv6. Dual-stack so local REDIS_URL
      // (IPv4) and Railway (IPv6) both work.
      family: 0,
    });
  }

  return globalScope.__bpRedis;
};

export const getClientIp = (req: Request): string => {
  // Cloudflare overwrites this with the true client IP and strips any
  // client-supplied copy, so it is both more accurate and harder to spoof than
  // x-forwarded-for. Checked first because the anonymous chat limit is keyed on
  // this value — resolving to a proxy IP would put every visitor in one bucket.
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  return realIp?.trim() || "unknown";
};

export const checkRateLimit = async (
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> => {
  const redis = getRedis();
  if (redis) {
    try {
      const redisKey = `${REDIS_PREFIX}:rate:${key}`;
      const result = (await redis.eval(
        rateLimitLua,
        1,
        redisKey,
        config.windowMs.toString()
      )) as [number, number];
      const count = Number(result?.[0] ?? 0);
      const ttl = Number(result?.[1] ?? config.windowMs);
      const allowed = count <= config.limit;
      return {
        allowed,
        remaining: Math.max(0, config.limit - count),
        resetMs: ttl > 0 ? ttl : config.windowMs,
      };
    } catch (error) {
      logRequest("rate_limit.redis_error", { error: String(error) });
    }
  }

  const now = Date.now();
  const existing = globalRateLimit.get(key);

  if (!existing || now > existing.resetAt) {
    const resetAt = now + config.windowMs;
    globalRateLimit.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.limit - 1, resetMs: config.windowMs };
  }

  if (existing.count >= config.limit) {
    return { allowed: false, remaining: 0, resetMs: existing.resetAt - now };
  }

  existing.count += 1;
  globalRateLimit.set(key, existing);
  return {
    allowed: true,
    remaining: Math.max(0, config.limit - existing.count),
    resetMs: existing.resetAt - now,
  };
};

export const logRequest = (message: string, meta?: Record<string, string | number | boolean>) => {
  const details = meta ? ` ${JSON.stringify(meta)}` : "";
  console.info(`[nim] ${message}${details}`);
};

const getNimModels = () => {
  const primary = process.env.NIM_MODEL ?? "google/gemma-4-31b-it";
  const fallback = process.env.NIM_FALLBACK_MODEL;
  const models = [primary, fallback].filter((value): value is string => Boolean(value));
  return Array.from(new Set(models));
};

/** NVIDIA Nemotron 3 Embed 1B via OpenRouter. Native 2048-d; we store a 1024-d slice. */
export const DEFAULT_EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b:free";
/** Must match `ScholarshipDoc.embedding VECTOR(1024)`. */
export const EMBEDDING_DIMENSIONS = 1024;

/** Models / hosts that are gone, or NVIDIA-only and not on OpenRouter. */
const RETIRED_EMBEDDING_MODELS = new Set([
  "nvidia/nv-embedqa-e5-v5",
  "nvidia/llama-nemotron-embed-1b-v2",
]);

let warnedRetiredEmbeddingModel = false;

const getEmbeddingModel = () => {
  const configured = (
    process.env.OPENROUTER_EMBEDDING_MODEL ||
    process.env.NIM_EMBEDDING_MODEL ||
    ""
  ).trim();
  if (!configured || RETIRED_EMBEDDING_MODELS.has(configured)) {
    if (configured && !warnedRetiredEmbeddingModel) {
      warnedRetiredEmbeddingModel = true;
      logRequest("embedding.model.retired", {
        configured,
        using: DEFAULT_EMBEDDING_MODEL,
      });
    }
    return DEFAULT_EMBEDDING_MODEL;
  }
  return configured;
};

const getEmbeddingUrl = () => {
  const configured = (
    process.env.OPENROUTER_EMBEDDING_URL ||
    process.env.NIM_EMBEDDING_URL ||
    ""
  ).trim();
  if (!configured || configured.includes("integrate.api.nvidia.com")) {
    return DEFAULT_EMBEDDING_URL;
  }
  return configured;
};

const embeddingHeaders = (apiKey: string): HeadersInit => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const referer = process.env.OPENROUTER_SITE_URL;
  const title = process.env.OPENROUTER_APP_NAME;
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;
  return headers;
};

/** Truncate a longer Matryoshka / native vector to VECTOR(1024) and L2-normalize. */
export const fitEmbeddingDimensions = (embedding: number[]): number[] => {
  if (embedding.length === EMBEDDING_DIMENSIONS) return embedding;
  if (embedding.length > EMBEDDING_DIMENSIONS) {
    const sliced = embedding.slice(0, EMBEDDING_DIMENSIONS);
    const mag = Math.sqrt(sliced.reduce((sum, x) => sum + x * x, 0));
    if (mag === 0) throw new Error("Embedding is a zero vector after truncation");
    return sliced.map((x) => x / mag);
  }
  throw new Error(
    `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`,
  );
};

export const fetchNimWithFallback = async (
  payload: Omit<NimChatPayload, "model">,
  options: { apiKey: string; accept: string }
): Promise<NimFetchResult> => {
  const models = getNimModels();
  let lastError: Error | null = null;

  for (const model of models) {
    const requestBody: NimChatPayload = { ...payload, model };
    try {
      const response = await fetch(NIM_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
          Accept: options.accept,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const text = await response.text();
        lastError = new Error(`NIM error (${response.status}) for ${model}: ${text}`);
        continue;
      }

      return { response, model };
    } catch (error) {
      lastError = new Error(`NIM network error for ${model}: ${String(error)}`);
    }
  }

  throw lastError ?? new Error("NIM request failed");
};

export const generateEmbedding = async (
  input: string,
  apiKey: string,
  inputType: "query" | "passage" = "passage"
): Promise<number[]> => {
  const response = await fetch(getEmbeddingUrl(), {
    method: "POST",
    headers: embeddingHeaders(apiKey),
    body: JSON.stringify({
      model: getEmbeddingModel(),
      input,
      input_type: inputType,
      encoding_format: "float",
      // Nemotron 3 Embed 1B only accepts native 2048-d. We slice + L2-normalize
      // to VECTOR(1024) in fitEmbeddingDimensions after the response.
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Embedding error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    data?: { embedding?: number[] }[];
  };

  const embedding = data?.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Embedding response missing embedding array");
  }

  return fitEmbeddingDimensions(embedding);
};

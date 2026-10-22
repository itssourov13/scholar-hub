import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, generateEmbedding } from "../nim";

beforeEach(() => {
  vi.stubEnv("NIM_EMBEDDING_MODEL", "");
  vi.stubEnv("OPENROUTER_EMBEDDING_MODEL", "");
  vi.stubEnv("NIM_EMBEDDING_URL", "");
  vi.stubEnv("OPENROUTER_EMBEDDING_URL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const embedding1024 = (fill = 0.1) => Array.from({ length: EMBEDDING_DIMENSIONS }, () => fill);

function requestBody(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  return JSON.parse(String(fetchMock.mock.calls[call][1].body)) as Record<string, unknown>;
}

describe("generateEmbedding", () => {
  test("returns the embedding on success", async () => {
    const vector = embedding1024(1);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ embedding: vector }] })),
    );

    await expect(generateEmbedding("hello", "key")).resolves.toEqual(vector);
  });

  test("requests the OpenRouter NVIDIA embed model without a dimensions override", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [{ embedding: embedding1024() }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateEmbedding("hello", "key", "query");

    expect(fetchMock.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/embeddings");
    expect(requestBody(fetchMock)).toMatchObject({
      model: DEFAULT_EMBEDDING_MODEL,
      input: "hello",
      input_type: "query",
    });
    expect(requestBody(fetchMock)).not.toHaveProperty("dimensions");
  });

  test("ignores retired NVIDIA-only embedding model env overrides", async () => {
    vi.stubEnv("NIM_EMBEDDING_MODEL", "nvidia/nv-embedqa-e5-v5");
    vi.stubEnv("OPENROUTER_EMBEDDING_MODEL", "nvidia/llama-nemotron-embed-1b-v2");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [{ embedding: embedding1024() }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateEmbedding("hello", "key");

    expect(requestBody(fetchMock).model).toBe(DEFAULT_EMBEDDING_MODEL);
  });

  test("slices and L2-normalizes a 2048-d NVIDIA vector into VECTOR(1024)", async () => {
    const raw = Array.from({ length: 2048 }, (_, i) => (i === 0 ? 4 : 0));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ embedding: raw }] })),
    );

    const fitted = await generateEmbedding("hello", "key");
    expect(fitted).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(fitted[0]).toBeCloseTo(1);
    expect(fitted[1]).toBeCloseTo(0);
  });

  test("rejects a vector that is shorter than VECTOR(1024)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ embedding: [1, 2, 3] }] })),
    );

    await expect(generateEmbedding("hello", "key")).rejects.toThrow(
      /Embedding dimension mismatch: expected 1024, got 3/,
    );
  });

  test("surfaces an error without re-reading the Response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(429, { error: { message: "rate limit exceeded" } })),
    );

    await expect(generateEmbedding("hello", "key")).rejects.toThrow(
      /Embedding error \(429\):.*rate limit exceeded/,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

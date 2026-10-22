import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { extractJsonObject, fetchCompletion, parseJsonFromCompletion } from "../ai-completion";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("parseJsonFromCompletion", () => {
  test("parses a bare object", () => {
    expect(parseJsonFromCompletion('{"title":"NYCU OIA"}')).toEqual({ title: "NYCU OIA" });
  });

  test("strips markdown fences", () => {
    expect(parseJsonFromCompletion('```json\n{"title":"NYCU OIA"}\n```')).toEqual({ title: "NYCU OIA" });
  });

  test("ignores <think> wrappers that reasoning models leak into content", () => {
    const raw = `<think>\nI will emit {"title":"wrong"}\n</think>\n{"title":"NYCU OIA Scholarship"}`;
    expect(parseJsonFromCompletion(raw)).toEqual({ title: "NYCU OIA Scholarship" });
  });

  test("extracts an object wrapped in prose", () => {
    const raw = 'Here is the record:\n{"title":"NYCU OIA","country":"Taiwan"}\nDone.';
    expect(parseJsonFromCompletion(raw)).toEqual({ title: "NYCU OIA", country: "Taiwan" });
  });

  test("throws when the object was truncated mid-string", () => {
    expect(() => parseJsonFromCompletion('{"title":"NYCU OIA","raw_description_english":"The')).toThrow();
  });
});

describe("extractJsonObject", () => {
  test("strips thinking tags before looking for braces", () => {
    const raw = `<think>{"decoy":true}</think>{"ok":true}`;
    expect(extractJsonObject(raw)).toEqual({ ok: true });
  });
});

describe("fetchCompletion", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "deepseek/deepseek-v4-flash");
  });

  test("leaves reasoning unset unless asked, and can request JSON mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"title":"NYCU OIA"}' } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchCompletion({
      model: "deepseek",
      system: "sys",
      user: "user",
      json: true,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as Record<string, unknown>;
    expect(body.reasoning).toBeUndefined();
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  test("flattens array-shaped message content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: [
                    { type: "text", text: '{"title":' },
                    { type: "text", text: '"NYCU OIA"}' },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await fetchCompletion({
      model: "deepseek",
      system: "sys",
      user: "user",
    });
    expect(result.content).toBe('{"title":"NYCU OIA"}');
  });
});

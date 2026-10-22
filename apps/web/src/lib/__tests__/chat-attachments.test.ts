import { afterEach, describe, expect, test, vi } from "vitest";
import {
  buildOpenRouterUserContent,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MAX_COUNT,
  DEFAULT_CHAT_ATTACHMENT_PROMPT,
  formatByteCap,
  formatStoredUserMessage,
  normalizeChatMime,
  parseChatAttachments,
} from "../chat-attachments";
import { getOpenRouterChatModels } from "../openrouter";

afterEach(() => {
  vi.unstubAllEnvs();
});

const tinyPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

function b64ForBytes(bytes: number): string {
  const chars = Math.ceil((bytes * 4) / 3);
  const padded = chars + ((4 - (chars % 4)) % 4);
  return "A".repeat(padded);
}

describe("getOpenRouterChatModels", () => {
  test("text turns try DeepSeek first, then Gemini", () => {
    vi.stubEnv("OPENROUTER_MODEL", "deepseek/deepseek-v4-flash");
    vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "google/gemini-3.7-flash");
    expect(getOpenRouterChatModels()).toEqual([
      "deepseek/deepseek-v4-flash",
      "google/gemini-3.7-flash",
    ]);
  });

  test("attachment turns use Luna, not Gemini", () => {
    vi.stubEnv("OPENROUTER_MODEL", "deepseek/deepseek-v4-flash");
    vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "google/gemini-3.7-flash");
    vi.stubEnv("OPENROUTER_VISION_MODEL", "");
    expect(getOpenRouterChatModels({ multimodal: true })).toEqual(["openai/gpt-5.6-luna"]);
  });

  test("OPENROUTER_VISION_MODEL overrides the default vision model", () => {
    vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "google/gemini-3.7-flash");
    vi.stubEnv("OPENROUTER_VISION_MODEL", "openai/gpt-5.6-luna");
    expect(getOpenRouterChatModels({ multimodal: true })).toEqual(["openai/gpt-5.6-luna"]);
  });
});

describe("parseChatAttachments", () => {
  test("absent attachments are ok", () => {
    expect(parseChatAttachments(undefined)).toEqual({ ok: true, attachments: [] });
  });

  test("rejects more than the cap", () => {
    const tooMany = Array.from({ length: CHAT_ATTACHMENT_MAX_COUNT + 1 }, (_, i) => ({
      name: `f${i}.png`,
      mimeType: "image/png",
      data: tinyPng,
    }));
    const result = parseChatAttachments(tooMany);
    expect(result.ok).toBe(false);
  });

  test("accepts a JPEG aliased as image/jpg", () => {
    const result = parseChatAttachments([
      { name: "shot.jpg", mimeType: "image/jpg", data: tinyPng },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attachments[0]).toMatchObject({ mimeType: "image/jpeg", kind: "image" });
  });

  test("accepts a PDF", () => {
    const result = parseChatAttachments([
      { name: "offer.pdf", mimeType: "application/pdf", data: tinyPng },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attachments[0]).toMatchObject({ mimeType: "application/pdf", kind: "file" });
  });

  test("rejects an oversized file", () => {
    const result = parseChatAttachments([
      { name: "huge.png", mimeType: "image/png", data: b64ForBytes(CHAT_ATTACHMENT_MAX_BYTES + 32) },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(formatByteCap(CHAT_ATTACHMENT_MAX_BYTES));
  });

  test("rejects an unsupported type", () => {
    const result = parseChatAttachments([
      { name: "notes.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", data: tinyPng },
    ]);
    expect(result.ok).toBe(false);
  });
});

describe("buildOpenRouterUserContent", () => {
  test("images use image_url data URIs; PDFs use the file part", () => {
    const parts = buildOpenRouterUserContent("What is this deadline?", [
      { name: "shot.png", mimeType: "image/png", data: tinyPng, kind: "image" },
      { name: "offer.pdf", mimeType: "application/pdf", data: tinyPng, kind: "file" },
    ]);
    expect(parts[0]).toEqual({ type: "text", text: "What is this deadline?" });
    expect(parts[1]).toEqual({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${tinyPng}` },
    });
    expect(parts[2]).toEqual({
      type: "file",
      file: { filename: "offer.pdf", file_data: `data:application/pdf;base64,${tinyPng}` },
    });
  });

  test("empty caption falls back to the default prompt", () => {
    const parsed = parseChatAttachments([{ name: "shot.png", mimeType: "image/png", data: tinyPng }]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(buildOpenRouterUserContent("  ", parsed.attachments)[0]).toEqual({
      type: "text",
      text: DEFAULT_CHAT_ATTACHMENT_PROMPT,
    });
  });
});

describe("formatStoredUserMessage", () => {
  test("appends attachment names once", () => {
    const parsed = parseChatAttachments([{ name: "shot.png", mimeType: "image/png", data: tinyPng }]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const once = formatStoredUserMessage("Look", parsed.attachments);
    expect(once).toBe("Look\n\n[Attached: shot.png]");
    expect(formatStoredUserMessage(once, parsed.attachments)).toBe(once);
  });
});

describe("normalizeChatMime", () => {
  test("infers pdf from the filename when the picker leaves mime blank", () => {
    expect(normalizeChatMime("", "offer.PDF")).toBe("application/pdf");
  });
});

import type { OpenRouterContentPart } from "@/lib/openrouter";

/** Keep numeric caps in sync with `packages/shared/src/types.ts`. */
const CHAT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;
const CHAT_FILE_MIME_TYPES = ["application/pdf"] as const;
export const CHAT_ATTACHMENT_MAX_COUNT = 1;
export const CHAT_ATTACHMENT_MAX_BYTES = 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_TOTAL_BYTES = 1024 * 1024;
export const DEFAULT_CHAT_ATTACHMENT_PROMPT =
  "Please look at the attached file(s) and tell me what matters for my scholarship applications.";

export type ParsedChatAttachment = {
  name: string;
  mimeType: string;
  /** Raw base64, no data: prefix. */
  data: string;
  kind: "image" | "file";
};

export type ParseAttachmentsResult =
  | { ok: true; attachments: ParsedChatAttachment[] }
  | { ok: false; error: string };

const IMAGE_MIMES = new Set<string>(CHAT_IMAGE_MIME_TYPES);
const FILE_MIMES = new Set<string>(CHAT_FILE_MIME_TYPES);

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

export function normalizeChatMime(raw: string, fileName: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "image/jpg") return "image/jpeg";
  if (IMAGE_MIMES.has(trimmed) || FILE_MIMES.has(trimmed)) return trimmed;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? trimmed;
}

function kindForMime(mime: string): "image" | "file" | null {
  if (IMAGE_MIMES.has(mime)) return "image";
  if (FILE_MIMES.has(mime)) return "file";
  return null;
}

function stripDataUrl(raw: string): string {
  const match = /^data:[^;]+;base64,([\s\S]+)$/.exec(raw.trim());
  return match ? match[1].replace(/\s/g, "") : raw.trim().replace(/\s/g, "");
}

/** Base64 length → decoded byte length, ignoring padding. */
function decodedBytes(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export function formatByteCap(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

function safeName(raw: string): string {
  const name = raw.replace(/[/\\]/g, "").trim() || "attachment";
  return name.slice(0, 120);
}

/**
 * Validates the `attachments` field on `POST /api/chat`. Unknown / oversized
 * / extra files are rejected rather than silently dropped — the student should
 * know the mentor never saw the file.
 */
export function parseChatAttachments(raw: unknown): ParseAttachmentsResult {
  if (raw === undefined || raw === null) return { ok: true, attachments: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "attachments must be an array." };
  if (raw.length > CHAT_ATTACHMENT_MAX_COUNT) {
    return {
      ok: false,
      error:
        CHAT_ATTACHMENT_MAX_COUNT === 1
          ? "You can attach 1 file per message."
          : `You can attach up to ${CHAT_ATTACHMENT_MAX_COUNT} files.`,
    };
  }

  const attachments: ParsedChatAttachment[] = [];
  let total = 0;

  for (const item of raw) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return { ok: false, error: "Each attachment must be an object." };
    }
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === "string" ? safeName(rec.name) : "attachment";
    const data = typeof rec.data === "string" ? stripDataUrl(rec.data) : "";
    if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length < 8) {
      return { ok: false, error: `Could not read ${name}. Try another photo or PDF.` };
    }

    const mime = normalizeChatMime(typeof rec.mimeType === "string" ? rec.mimeType : "", name);
    const kind = kindForMime(mime);
    if (!kind) {
      return {
        ok: false,
        error: `${name} is not a supported type. Attach a photo (JPEG, PNG, WebP) or a PDF.`,
      };
    }

    const bytes = decodedBytes(data);
    if (bytes <= 0 || bytes > CHAT_ATTACHMENT_MAX_BYTES) {
      return {
        ok: false,
        error: `${name} is too large (max ${formatByteCap(CHAT_ATTACHMENT_MAX_BYTES)}).`,
      };
    }
    total += bytes;
    if (total > CHAT_ATTACHMENT_MAX_TOTAL_BYTES) {
      return { ok: false, error: `Those files together are too large (max ${formatByteCap(CHAT_ATTACHMENT_MAX_TOTAL_BYTES)}).` };
    }

    attachments.push({ name, mimeType: mime, data, kind });
  }

  return { ok: true, attachments };
}

export function formatStoredUserMessage(text: string, attachments: ParsedChatAttachment[]): string {
  const stripped = text.replace(/\n\n\[Attached: [^\]]+\]\s*$/, "").trim();
  const body = stripped || (attachments.length ? DEFAULT_CHAT_ATTACHMENT_PROMPT : "");
  if (attachments.length === 0) return body;
  return `${body}\n\n[Attached: ${attachments.map((a) => a.name).join(", ")}]`;
}

export function buildOpenRouterUserContent(
  text: string,
  attachments: ParsedChatAttachment[],
): OpenRouterContentPart[] {
  const body = text.trim() || DEFAULT_CHAT_ATTACHMENT_PROMPT;
  const parts: OpenRouterContentPart[] = [{ type: "text", text: body }];
  for (const file of attachments) {
    const dataUrl = `data:${file.mimeType};base64,${file.data}`;
    if (file.kind === "image") {
      parts.push({ type: "image_url", image_url: { url: dataUrl } });
    } else {
      parts.push({ type: "file", file: { filename: file.name, file_data: dataUrl } });
    }
  }
  return parts;
}

export const ATTACHMENT_SYSTEM_NOTE =
  "The student attached file(s) on this turn (screenshots, photos, or PDFs). Read every visible page. Quote deadlines, scores, names and figures exactly as written. If something is unreadable, say so rather than guessing.";

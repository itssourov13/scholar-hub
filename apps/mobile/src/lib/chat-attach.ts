import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File as FsFile } from "expo-file-system";
import {
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MAX_COUNT,
  CHAT_ATTACHMENT_MAX_TOTAL_BYTES,
  CHAT_FILE_MIME_TYPES,
  CHAT_IMAGE_MIME_TYPES,
  DEFAULT_CHAT_ATTACHMENT_PROMPT,
} from "@scholarhub/shared";

/** Why the student attached a file — drives picker + the default mentor prompt. */
export type AttachIntent = "cv" | "transcript" | "letter" | "screenshot";

export type PendingAttachment = {
  id: string;
  name: string;
  mimeType: string;
  uri: string;
  data: string;
  size: number;
  intent: AttachIntent;
};

export class ChatAttachError extends Error {
  constructor(readonly code: "too-large" | "too-many" | "unsupported" | "unreadable") {
    super(code);
    this.name = "ChatAttachError";
  }
}

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

const INTENT_FALLBACK_NAME: Record<AttachIntent, string> = {
  cv: "cv.pdf",
  transcript: "transcript.pdf",
  letter: "letter.pdf",
  screenshot: "screenshot.jpg",
};

export function isChatImageMime(mime: string): boolean {
  return IMAGE_MIMES.has(mime);
}

export function formatChatAttachmentMessage(
  text: string,
  names: string[],
  emptyPrompt = DEFAULT_CHAT_ATTACHMENT_PROMPT,
): string {
  const stripped = text.replace(/\n\n\[Attached: [^\]]+\]\s*$/, "").trim();
  const body = stripped || (names.length ? emptyPrompt : "");
  if (!names.length) return body;
  return `${body}\n\n[Attached: ${names.join(", ")}]`;
}

function normalizeMime(raw: string | null | undefined, name: string): string {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (trimmed === "image/jpg") return "image/jpeg";
  if (IMAGE_MIMES.has(trimmed) || FILE_MIMES.has(trimmed)) return trimmed;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? trimmed;
}

async function readAsset(
  uri: string,
  name: string,
  mimeHint: string | null | undefined,
  intent: AttachIntent,
): Promise<PendingAttachment> {
  const mime = normalizeMime(mimeHint, name);
  if (!IMAGE_MIMES.has(mime) && !FILE_MIMES.has(mime)) {
    throw new ChatAttachError("unsupported");
  }
  try {
    const file = new FsFile(uri);
    const size = file.info().size ?? 0;
    if (size > CHAT_ATTACHMENT_MAX_BYTES) throw new ChatAttachError("too-large");
    const data = await file.base64();
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      mimeType: mime,
      uri,
      data,
      size: size || Math.floor((data.length * 3) / 4),
      intent,
    };
  } catch (err) {
    if (err instanceof ChatAttachError) throw err;
    throw new ChatAttachError("unreadable");
  }
}

function assertCapacity(existing: number, adding: number, extraBytes: number, currentBytes: number) {
  if (existing + adding > CHAT_ATTACHMENT_MAX_COUNT) throw new ChatAttachError("too-many");
  if (currentBytes + extraBytes > CHAT_ATTACHMENT_MAX_TOTAL_BYTES) throw new ChatAttachError("too-large");
}

async function pickChatPhotos(intent: AttachIntent): Promise<PendingAttachment[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.55,
    allowsMultipleSelection: false,
    selectionLimit: 1,
    exif: false,
  });
  if (result.canceled || !result.assets?.length) return [];

  const asset = result.assets[0];
  const name = asset.fileName || INTENT_FALLBACK_NAME[intent];
  const next = await readAsset(asset.uri, name, asset.mimeType, intent);
  assertCapacity(0, 1, next.size, 0);
  return [next];
}

async function pickChatFiles(intent: AttachIntent, pdfOnly: boolean): Promise<PendingAttachment[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: pdfOnly
      ? ["application/pdf"]
      : ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return [];

  const asset = result.assets[0];
  const name = asset.name || INTENT_FALLBACK_NAME[intent];
  const next = await readAsset(asset.uri, name, asset.mimeType, intent);
  assertCapacity(0, 1, next.size, 0);
  return [next];
}

/** One file, replacing anything already queued (the API allows a single attachment). */
export async function pickChatAttachment(intent: AttachIntent): Promise<PendingAttachment[]> {
  if (intent === "screenshot") return pickChatPhotos(intent);
  return pickChatFiles(intent, intent === "cv");
}

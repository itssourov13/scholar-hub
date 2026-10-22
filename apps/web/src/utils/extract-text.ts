import mammoth from "mammoth";

export const MAX_CV_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

export const ACCEPTED_CV_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain",
  "application/msword", // .doc (best-effort — often still zipped docx)
];

export class UnsupportedFileError extends Error {}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // `unpdf` ships a serverless-friendly build of pdf.js (no canvas / worker
  // native deps), which is why it works reliably on Vercel where `pdf-parse`
  // crashes the function at import.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  // With `mergePages: true`, `text` is a single concatenated string.
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text).trim();
}

/**
 * Extract plain text from an uploaded CV file (PDF / DOCX / TXT).
 * Throws {@link UnsupportedFileError} for unknown types so the caller can
 * return a 400 rather than a 500.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  const type = file.type;

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }

  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value.trim();
  }

  if (type === "text/plain" || name.endsWith(".txt")) {
    return buffer.toString("utf-8").trim();
  }

  throw new UnsupportedFileError(
    "Unsupported file type. Please upload a PDF, DOCX, or TXT file.",
  );
}

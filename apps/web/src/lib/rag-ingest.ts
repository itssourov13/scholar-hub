/**
 * Chunking + embedding for the `ScholarshipDoc` pgvector store.
 *
 * Every chunk is prefixed with a `scholarshipTag(...)` identity line. Without
 * it, only the first chunk of each scholarship carried the title and deadline,
 * so the mentor routinely retrieved anonymous mid-description fragments and
 * fell back to guessing which programme (and which deadline) they belonged to.
 */

import { sql } from "@/utils/db";
import { generateEmbedding } from "@/lib/nim";
import {
  formatScholarshipFacts,
  scholarshipTag,
  type ScholarshipFactRow,
} from "@/lib/scholarship-facts";

export type RequiredDocuments = {
  core?: string[];
  additional?: string[];
  note?: string;
};

export type ScholarshipIngestRecord = ScholarshipFactRow & {
  raw_description: string | null;
  ai_summary: string | null;
  tips: string | null;
  tags: string[] | null;
  required_documents: RequiredDocuments | null;
};

/** Body budget per chunk, before the identity prefix is added. */
const CHUNK_BODY_CHARS = 800;

/**
 * Breaks prose into units that end on a paragraph or sentence boundary, so a
 * chunk never opens mid-word ("rship 2026 offers..."). A single sentence longer
 * than the budget is hard-cut as a last resort.
 */
const splitIntoUnits = (text: string, maxLen: number): string[] => {
  const units: string[] = [];

  for (const paragraph of text.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (trimmed.length <= maxLen) {
      units.push(trimmed);
      continue;
    }

    let buffer = "";
    for (const sentence of trimmed.split(/(?<=[.!?])\s+/)) {
      if (sentence.length > maxLen) {
        if (buffer.trim()) units.push(buffer.trim());
        buffer = "";
        for (let i = 0; i < sentence.length; i += maxLen) {
          units.push(sentence.slice(i, i + maxLen).trim());
        }
        continue;
      }

      if (buffer && `${buffer} ${sentence}`.length > maxLen) {
        units.push(buffer.trim());
        buffer = sentence;
      } else {
        buffer = buffer ? `${buffer} ${sentence}` : sentence;
      }
    }

    if (buffer.trim()) units.push(buffer.trim());
  }

  return units;
};

/** Packs units into chunks, repeating the trailing unit for one-unit overlap. */
const packUnits = (units: string[], maxLen: number): string[] => {
  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const unit of units) {
    if (current.length && length + unit.length > maxLen) {
      chunks.push(current.join("\n\n"));
      const carry = current[current.length - 1];
      current = carry.length <= maxLen / 2 ? [carry] : [];
      length = current.reduce((sum, u) => sum + u.length, 0);
    }
    current.push(unit);
    length += unit.length;
  }

  if (current.length) chunks.push(current.join("\n\n"));
  return chunks;
};

/**
 * Builds the chunk texts for one scholarship. The first chunk is always the
 * authoritative fact sheet, so a "when is the deadline for X" query can match a
 * chunk that literally answers it.
 */
export const buildScholarshipChunks = (record: ScholarshipIngestRecord): string[] => {
  const tag = scholarshipTag(record);
  const facts = formatScholarshipFacts(record);

  const documents = [
    record.required_documents?.core?.length
      ? `Required documents: ${record.required_documents.core.join(", ")}`
      : null,
    record.required_documents?.additional?.length
      ? `Additional documents: ${record.required_documents.additional.join(", ")}`
      : null,
  ].filter(Boolean) as string[];

  const sections = [
    record.ai_summary ? `Summary:\n${record.ai_summary}` : null,
    record.eligibility_summary ? `Eligibility:\n${record.eligibility_summary}` : null,
    record.raw_description ? `Description:\n${record.raw_description}` : null,
    record.tips ? `Tips:\n${record.tips}` : null,
    documents.length ? documents.join("\n") : null,
    record.tags?.length ? `Tags: ${record.tags.join(", ")}` : null,
  ].filter(Boolean) as string[];

  const bodyChunks = packUnits(
    splitIntoUnits(sections.join("\n\n"), CHUNK_BODY_CHARS),
    CHUNK_BODY_CHARS,
  );

  return [facts, ...bodyChunks.map((body) => `${tag}\n${body}`)];
};

export type IngestResult = { id: string; chunks: number; error?: string };

/** Re-embeds one scholarship, replacing its existing chunks atomically enough. */
export const ingestScholarship = async (
  record: ScholarshipIngestRecord,
  apiKey: string,
): Promise<IngestResult> => {
  const chunks = buildScholarshipChunks(record);

  try {
    const embedded: { content: string; embedding: number[] }[] = [];
    for (const chunk of chunks) {
      embedded.push({ content: chunk, embedding: await generateEmbedding(chunk, apiKey, "passage") });
    }

    // Only drop the old chunks once every new embedding succeeded, so a failed
    // ingest leaves the scholarship searchable with its previous vectors.
    await sql`DELETE FROM "ScholarshipDoc" WHERE scholarship_id = ${record.id}`;

    for (let i = 0; i < embedded.length; i++) {
      await sql`
        INSERT INTO "ScholarshipDoc" (content, embedding, scholarship_id, metadata)
        VALUES (
          ${embedded[i].content},
          ${JSON.stringify(embedded[i].embedding)}::vector,
          ${record.id},
          ${JSON.stringify({
            index: i,
            title: record.title,
            country: record.country,
            deadline: record.deadline,
          })}::jsonb
        )
      `;
    }

    return { id: record.id, chunks: embedded.length };
  } catch (err) {
    return { id: record.id, chunks: 0, error: String(err) };
  }
};

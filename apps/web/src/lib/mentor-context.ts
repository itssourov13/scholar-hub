/**
 * Context assembly for the AI mentor.
 *
 * Two blocks get built here and prepended to the system prompt on every chat
 * turn:
 *
 *  1. The student's profile summary, so advice is personalised without the
 *     client having to send (or being able to forge) profile fields.
 *  2. Retrieved scholarship context. Vector search picks the relevant
 *     scholarships, but the facts the model is told to quote — deadlines above
 *     all — are re-read from the `scholarships` table at request time rather
 *     than taken from the embedded prose, which may be stale or truncated.
 */

import { sql } from "@/utils/db";
import { generateEmbedding, logRequest } from "@/lib/nim";
import { formatScholarshipFacts, type ScholarshipFactRow } from "@/lib/scholarship-facts";

/**
 * nvidia/nemotron-3-embed-1b (1024-d slice of the 2048-d vector) typically
 * scores relevant query/passage pairs well above this floor. The previous 0.7
 * threshold discarded almost every match with the retired e5 model, which left
 * the mentor answering scholarship questions from parametric memory.
 */
const MATCH_THRESHOLD = Number(process.env.RAG_MATCH_THRESHOLD ?? 0.35);
const MATCH_COUNT = Number(process.env.RAG_MATCH_COUNT ?? 10);
/** How many distinct scholarships get a full fact sheet in the prompt. */
const MAX_SCHOLARSHIPS = Number(process.env.RAG_MAX_SCHOLARSHIPS ?? 5);
const MAX_EXCERPTS = 5;

export type MentorProfile = {
  id: string;
  role: string | null;
  full_name: string | null;
  cgpa: string | number | null;
  work_experience: string | null;
  target_degree: string | null;
  preferred_countries: string | null;
  goals_notes: string | null;
  bsc_major: string | null;
  university: string | null;
  graduation_year: number | null;
  research_interests: string | null;
  published_papers: string | null;
  ielts_score: string | null;
  gre_gmat_score: string | null;
  internships: string | null;
  portfolio_url: string | null;
};

export type ScholarshipContext = {
  /** Text appended to the system prompt. Empty when nothing was retrieved. */
  block: string;
  scholarshipIds: string[];
};

const clean = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};

/**
 * Renders the profile as a compact block. Returns an empty string for a profile
 * with nothing filled in, so we don't tell the model "everything is unknown"
 * and have it open every reply by asking for the same fields.
 */
export const buildProfileBlock = (profile: MentorProfile | null): string => {
  if (!profile) return "";

  const fields: [string, string | null][] = [
    ["Name", clean(profile.full_name)],
    ["Target degree", clean(profile.target_degree)],
    ["Preferred countries", clean(profile.preferred_countries)],
    ["Undergraduate major", clean(profile.bsc_major)],
    ["University", clean(profile.university)],
    ["Graduation year", clean(profile.graduation_year)],
    ["CGPA", clean(profile.cgpa)],
    ["IELTS", clean(profile.ielts_score)],
    ["GRE/GMAT", clean(profile.gre_gmat_score)],
    ["Research interests", clean(profile.research_interests)],
    ["Publications", clean(profile.published_papers)],
    ["Work experience", clean(profile.work_experience)],
    ["Internships", clean(profile.internships)],
    ["Portfolio", clean(profile.portfolio_url)],
    ["Goals", clean(profile.goals_notes)],
  ];

  const filled = fields.filter(([, value]) => value !== null);
  if (!filled.length) return "";

  const missing = fields.filter(([, value]) => value === null).map(([label]) => label);

  return [
    "STUDENT PROFILE (from their ScholarHub profile — use it to personalise every answer):",
    ...filled.map(([label, value]) => `- ${label}: ${value}`),
    missing.length ? `- Not filled in yet: ${missing.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
};

/** Loads the profile and role in one query — the chat route needs both. */
export const loadMentorProfile = async (userId: string): Promise<MentorProfile | null> => {
  try {
    const rows = (await sql`
      SELECT id, role, full_name, cgpa, work_experience, target_degree, preferred_countries,
             goals_notes, bsc_major, university, graduation_year, research_interests,
             published_papers, ielts_score, gre_gmat_score, internships, portfolio_url
      FROM profiles WHERE id = ${userId} LIMIT 1
    `) as MentorProfile[];
    return rows[0] ?? null;
  } catch (err) {
    logRequest("mentor.profile.error", { userId, error: String(err) });
    return null;
  }
};

/** Fact sheets for an explicit set of scholarships (e.g. the detail page panel). */
export const loadScholarshipFacts = async (ids: string[]): Promise<ScholarshipFactRow[]> => {
  if (!ids.length) return [];
  return (await sql`
    SELECT id, title, country, degree_level, funding_type, deadline, is_live, opening_note,
           official_url, competitiveness, eligibility_summary, slug
    FROM scholarships
    WHERE id = ANY(${ids}::uuid[])
  `) as ScholarshipFactRow[];
};

/**
 * Title-keyword fallback. Vector search alone misses questions phrased around a
 * proper noun ("Endeavour II deadline?"), so we also probe titles directly.
 */
const searchTitles = async (query: string): Promise<string[]> => {
  const terms = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .slice(0, 8);

  if (!terms.length) return [];

  const rows = (await sql`
    SELECT id
    FROM scholarships
    WHERE status = 'published'
      AND EXISTS (
        SELECT 1 FROM unnest(${terms}::text[]) AS term
        WHERE lower(title) LIKE '%' || term || '%'
      )
    ORDER BY (
      SELECT count(*) FROM unnest(${terms}::text[]) AS term
      WHERE lower(title) LIKE '%' || term || '%'
    ) DESC
    LIMIT 3
  `) as { id: string }[];

  return rows.map((row) => row.id);
};

/**
 * Hybrid retrieval: pgvector similarity over `ScholarshipDoc`, widened with a
 * title-keyword probe, then hydrated with live rows from `scholarships`.
 */
export const retrieveScholarshipContext = async (
  query: string,
  apiKey: string,
): Promise<ScholarshipContext> => {
  const empty: ScholarshipContext = { block: "", scholarshipIds: [] };
  if (!query.trim()) return empty;

  let matches: { scholarship_id: string | null; content: string; similarity: number }[] = [];
  try {
    const embedding = await generateEmbedding(query, apiKey, "query");
    matches = (await sql`
      SELECT scholarship_id, content, similarity
      FROM match_scholarship_docs(${JSON.stringify(embedding)}::vector, ${MATCH_THRESHOLD}, ${MATCH_COUNT})
    `) as typeof matches;
  } catch (err) {
    logRequest("rag.search.error", { error: String(err) });
  }

  let titleHits: string[] = [];
  try {
    titleHits = await searchTitles(query);
  } catch (err) {
    logRequest("rag.title_search.error", { error: String(err) });
  }

  // Vector hits first (ranked by similarity), then any title-only matches.
  const orderedIds: string[] = [];
  for (const id of [...matches.map((m) => m.scholarship_id), ...titleHits]) {
    if (id && !orderedIds.includes(id)) orderedIds.push(id);
  }

  const scholarshipIds = orderedIds.slice(0, MAX_SCHOLARSHIPS);
  if (!scholarshipIds.length) {
    logRequest("rag.context.empty", { queryLength: query.length });
    return empty;
  }

  let facts: ScholarshipFactRow[] = [];
  try {
    facts = await loadScholarshipFacts(scholarshipIds);
  } catch (err) {
    logRequest("rag.hydrate.error", { error: String(err) });
  }

  const byId = new Map(facts.map((row) => [row.id, row]));
  const factSheets = scholarshipIds
    .map((id) => byId.get(id))
    .filter((row): row is ScholarshipFactRow => Boolean(row))
    .map((row, index) => `### Scholarship ${index + 1}\n${formatScholarshipFacts(row)}`);

  if (!factSheets.length) return empty;

  // Prose excerpts stay in for nuance, but they are explicitly ranked below the
  // fact sheets so the model never prefers a stale date embedded in text.
  const excerpts = matches
    .filter((m) => m.scholarship_id && byId.has(m.scholarship_id))
    .slice(0, MAX_EXCERPTS)
    .map((m, index) => `Excerpt ${index + 1}: ${m.content}`);

  const block = [
    "",
    "=== VERIFIED SCHOLARSHIP DATA FROM THE SCHOLARHUB DATABASE ===",
    "These records are authoritative. Quote deadlines, funding and eligibility exactly as written below.",
    "",
    factSheets.join("\n\n"),
    excerpts.length ? `\nSupporting excerpts (background detail only):\n${excerpts.join("\n\n")}` : "",
    "=== END VERIFIED SCHOLARSHIP DATA ===",
  ].join("\n");

  logRequest("rag.context.built", {
    scholarships: factSheets.length,
    excerpts: excerpts.length,
    vectorHits: matches.length,
    titleHits: titleHits.length,
  });

  return { block, scholarshipIds };
};

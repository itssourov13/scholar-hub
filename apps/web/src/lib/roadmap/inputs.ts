/**
 * Loose stored text → typed engine inputs, and the known/unknown rule.
 *
 * The one rule that runs through every parser: **unknown is not zero.** Every
 * parser returns `T | null`. A declared zero — `"none"`, `"0"`, `"fresher"` — is a
 * known zero and comes back as `0`. Prose nobody can read as a number comes back
 * as `null`, which makes its pillar `known: false` and costs Confidence instead of
 * producing a Weakness. A student who wrote "some conference work" has not told us
 * they have no papers, so the engine must not accuse them of having none.
 *
 * Pure: no I/O, no clock. `toRoadmapInputs` reads a row someone else fetched.
 */

import {
  type DegreeLevel,
  type DocKey,
  type DocStatus,
  type EnglishTestStatus,
  type EnglishTestType,
  type InputKey,
  type IntakeTerm,
  type RoadmapInputs,
} from "./types";

export type ProfileRow = Record<string, unknown>;
export type Signals = { bookmarkCount: number; cvCount: number };

/** Exactly the eight student-supplied inputs, and nothing else.
 *
 *  `bookmarkCount` and `hasCvRow` are excluded on purpose: they are always known,
 *  so counting them would floor an empty profile at Confidence 25 rather than 0.
 *  The order here is the tie-break order for `highestWeightUnknown`. */
export const REQUIRED_INPUT_KEYS: readonly InputKey[] = [
  "degree",
  "cgpa",
  "english",
  "docs",
  "research",
  "experience",
  "target_country",
  "intake",
];

const DOC_STATUSES: readonly DocStatus[] = ["missing", "in_progress", "ready"];

/** Every `DocKey` except `lor_count`, which is a count rather than a status. */
const DOC_STATUS_KEYS: readonly Exclude<DocKey, "lor_count">[] = [
  "passport",
  "cv",
  "sop",
  "transcripts",
  "funding_proof",
  "lor",
  "aps",
  "blocked_account",
  "proof_of_funds",
  "pal",
  "i20",
  "ds160",
  "cas",
  "ihs",
  "professor_contact",
  "coe",
];

const ENGLISH_TYPES: readonly EnglishTestType[] = [
  "ielts",
  "toefl",
  "duolingo",
  "pte",
  "moi",
  "waiver",
];

const ENGLISH_STATUSES: readonly EnglishTestStatus[] = [
  "not_started",
  "preparing",
  "booked",
  "taken",
  "scored",
  "waived",
];

const INTAKE_TERMS: readonly IntakeTerm[] = ["spring", "summer", "fall", "winter"];

/** Words that declare an absence. A match with no digit present is a known zero,
 *  which is the only way a Weakness can be derived from a text field. */
const ZERO_WORDS =
  /\b(none|no|nil|nope|zero|nothing|na|n\/a|never|fresher|fresh\s+grad\w*|no\s+experience)\b/;

// ── Number extraction ───────────────────────────────────────────────────────

/** The first number in a string, tolerating a comma decimal separator ("3,65").
 *  Returns `null` when the string holds no digits at all. */
function firstNumberIn(text: string): number | null {
  const match = /-?\d+(?:[.,]\d+)?/.exec(text);
  if (!match) return null;
  const n = Number(match[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** A raw JSON value read as a number, whether it arrived as one or as text. */
function numericValueOf(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "boolean") return null;
  const text = String(raw).trim();
  if (text === "") return null;
  return firstNumberIn(text);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── CGPA ────────────────────────────────────────────────────────────────────

/**
 * `"3.65"` → `{ value: 3.65, scale: 4 }` · `"4.2"` → scale 5 · `"3,65"` → 3.65 ·
 * `"N/A"` → `null`.
 *
 * Scale is inferred from magnitude: above 4.0 means a 5-point scale, which is
 * common here. A value above 5 is not a CGPA on either scale — `85` is a
 * percentage the profile route accepts and stores, and guessing a scale for it
 * would hand a typo full marks — so it reads as unknown rather than as a score.
 */
export function parseCgpa(raw: unknown): { value: number; scale: 4 | 5 } | null {
  const n = numericValueOf(raw);
  if (n === null) return null;
  if (n <= 0 || n > 5) return null;
  return { value: round2(n), scale: n > 4 ? 5 : 4 };
}

// ── English band ────────────────────────────────────────────────────────────

type Band = number;
type BandTable = readonly (readonly [floor: number, band: Band])[];

/**
 * TOEFL iBT → IELTS equivalent, descending by floor. Every row follows the
 * published ETS comparison table, 94-101 for IELTS 7.0 included: a student who
 * scored 94 losing three points at the master weighting is a worse outcome than
 * a docstring example that has to be reworded.
 */
const TOEFL_TO_IELTS: BandTable = [
  [118, 9],
  [115, 8.5],
  [110, 8],
  [102, 7.5],
  [94, 7],
  [79, 6.5],
  [60, 6],
  [46, 5.5],
  [35, 5],
  [32, 4.5],
  [0, 4],
];

const DUOLINGO_TO_IELTS: BandTable = [
  [160, 9],
  [150, 8.5],
  [140, 8],
  [130, 7.5],
  [120, 7],
  [110, 6.5],
  [95, 6],
  [85, 5.5],
  [75, 5],
  [0, 4.5],
];

const PTE_TO_IELTS: BandTable = [
  [89, 9],
  [84, 8.5],
  [79, 8],
  [73, 7.5],
  [65, 7],
  [58, 6.5],
  [50, 6],
  [43, 5.5],
  [36, 5],
  [0, 4.5],
];

function fromTable(table: BandTable, score: number): Band {
  for (const [floor, band] of table) if (score >= floor) return band;
  return table[table.length - 1][1];
}

/** The maximum raw score each test can report, so a stray year in prose
 *  ("will take in June 2026") cannot be mistaken for a score. */
const TEST_CEILINGS: Record<"toefl" | "duolingo" | "pte", number> = {
  toefl: 120,
  duolingo: 160,
  pte: 90,
};

/** A test named inside the stored text wins over the declared type: the text is
 *  what the student actually wrote next to the number. */
function testNamedIn(text: string): EnglishTestType | null {
  if (/toefl/.test(text)) return "toefl";
  if (/duolingo|\bdet\b/.test(text)) return "duolingo";
  if (/\bpte\b/.test(text)) return "pte";
  if (/ielts/.test(text)) return "ielts";
  return null;
}

/**
 * `"7.5"` → 7.5 · `"IELTS 6.5 overall"` → 6.5 · `"TOEFL 92"` → 6.5 via
 * `TOEFL_TO_IELTS` · `"planned"` / `""` / `"will take in June"` → `null`.
 *
 * Never returns 0 for prose. A number above 9 is only read as a converted test
 * score when a test is actually named — by the text or by `type` — so a date or a
 * year in a sentence stays unknown instead of becoming a band.
 */
export function parseEnglishBand(
  raw: unknown,
  type: RoadmapInputs["english"]["type"],
): number | null {
  if (raw === null || raw === undefined) return null;
  const text = typeof raw === "string" ? raw.trim().toLowerCase() : String(raw);
  if (text === "") return null;
  const score = firstNumberIn(text);
  if (score === null || score <= 0) return null;

  const kind = testNamedIn(text) ?? type ?? null;

  // Anything at or below 9 is already an IELTS-equivalent band, whatever the
  // declared test: a student with `type: toefl` who typed "6.5" means 6.5.
  if (score <= 9) return round2(score);

  switch (kind) {
    case "toefl":
      return score <= TEST_CEILINGS.toefl ? fromTable(TOEFL_TO_IELTS, score) : null;
    case "duolingo":
      return score <= TEST_CEILINGS.duolingo ? fromTable(DUOLINGO_TO_IELTS, score) : null;
    case "pte":
      return score <= TEST_CEILINGS.pte ? fromTable(PTE_TO_IELTS, score) : null;
    default:
      // No test named and the number is off the band scale — unknown, not zero.
      return null;
  }
}

// ── Counts and durations ────────────────────────────────────────────────────

/**
 * `"2 published, 1 under review"` → 2 · `"none"` / `"0"` → 0 · `"some work"` →
 * `null`. The distinction between a declared zero and unparseable prose is the
 * whole point: only a declared zero can become a Weakness.
 */
export function countFromProse(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : null;
  if (typeof raw === "boolean") return null;
  const text = String(raw).trim().toLowerCase();
  if (text === "") return null;
  const n = firstNumberIn(text);
  if (n !== null) return Math.max(0, Math.floor(n));
  return ZERO_WORDS.test(text) ? 0 : null;
}

function unitAmount(text: string, unit: RegExp): number | null {
  const match = unit.exec(text);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * `"2 years 6 months"` → 30 · `"18 months"` → 18 · `"fresher"` / `"none"` → 0 ·
 * prose → `null`.
 *
 * A bare number with no unit stays `null`: "6" could be six months or six years,
 * and guessing would either flatter or shortchange the student.
 */
export function monthsFromProse(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : null;
  if (typeof raw === "boolean") return null;
  const text = String(raw).trim().toLowerCase();
  if (text === "") return null;

  const years = unitAmount(text, /(\d+(?:[.,]\d+)?)\s*(?:years?|yrs?|y)\b/);
  const months = unitAmount(text, /(\d+(?:[.,]\d+)?)\s*(?:months?|mos?|mnths?)\b/);
  if (years === null && months === null) return ZERO_WORDS.test(text) ? 0 : null;
  return Math.max(0, Math.round((years ?? 0) * 12 + (months ?? 0)));
}

// ── Documents, countries, degree ────────────────────────────────────────────

/** Allow-listed entries only. Anything else — an unknown key, an out-of-domain
 *  status, a `lor_count` outside 0-5 — is dropped, which is the same stance the
 *  profile route takes on the write side. */
export function normalizeDocs(raw: unknown): RoadmapInputs["docs"] {
  const docs: RoadmapInputs["docs"] = {};
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return docs;
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return docs;

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === "lor_count") {
      const n = Number(entry);
      if (Number.isInteger(n) && n >= 0 && n <= 5) docs.lor_count = n;
      continue;
    }
    const docKey = DOC_STATUS_KEYS.find((allowed) => allowed === key);
    if (!docKey) continue;
    if (typeof entry === "string" && DOC_STATUSES.includes(entry as DocStatus)) {
      docs[docKey] = entry as DocStatus;
    }
  }
  return docs;
}

/** `"Germany, Canada"` → `["Germany", "Canada"]` · `""` → `[]`. Splits on the
 *  separators students actually type, deduplicates case-insensitively and keeps
 *  the text as written, since `resolveCountry` lowercases at match time. */
export function splitCountries(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  const text = Array.isArray(raw) ? raw.join(",") : String(raw);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,;/|]|\band\b/i)) {
    const name = part.trim();
    if (name === "") continue;
    const fold = name.toLowerCase();
    if (seen.has(fold)) continue;
    seen.add(fold);
    out.push(name.slice(0, 64));
  }
  return out;
}

const DEGREE_PATTERNS: readonly (readonly [DegreeLevel, RegExp])[] = [
  ["phd", /\b(phd|ph\.?\s?d|doctoral|doctorate|dphil)\b/],
  ["master", /\b(master'?s?|masters|msc|m\.\s?sc|ms|ma|mba|meng|mtech|postgrad\w*|pg)\b/],
  [
    "bachelor",
    /\b(bachelor'?s?|bachelors|bsc|b\.\s?sc|ba|be|btech|beng|undergrad\w*|ug|honours|hons)\b/,
  ],
];

/** `"masters"` → `master` · `"PhD"` → `phd` · `"diploma"` → `null`. PhD is tested
 *  first so a "PhD (Masters completed)" string reads as the target, not the past. */
export function parseDegree(raw: unknown): DegreeLevel | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim().toLowerCase();
  if (text === "") return null;
  for (const [level, pattern] of DEGREE_PATTERNS) if (pattern.test(text)) return level;
  return null;
}

function parseEnglishType(raw: unknown): EnglishTestType | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return ENGLISH_TYPES.find((type) => type === value) ?? null;
}

function parseEnglishStatus(raw: unknown): EnglishTestStatus | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ENGLISH_STATUSES.find((status) => status === value) ?? null;
}

/** `DATE` and `TIMESTAMPTZ` columns arrive as a `Date` from the driver and as a
 *  string from a JSON body. Both reduce to `YYYY-MM-DD` without reading a clock. */
function parseDateOnly(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = raw instanceof Date ? raw.toISOString() : String(raw).trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : null;
}

function parseTimestamp(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return raw.toISOString();
  const text = String(raw).trim();
  return text === "" ? null : text;
}

function parseIntake(term: unknown, year: unknown): RoadmapInputs["intake"] {
  const rawTerm = typeof term === "string" ? term.trim().toLowerCase() : "";
  const normalized = rawTerm === "autumn" ? "fall" : rawTerm;
  const found = INTAKE_TERMS.find((candidate) => candidate === normalized);
  if (!found) return null;
  const n = numericValueOf(year);
  if (n === null || !Number.isInteger(n) || n < 1900 || n > 3000) return null;
  return { term: found, year: n };
}

function nonEmptyText(raw: unknown, max: number): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  return text === "" ? null : text.slice(0, max);
}

// ── Assembly ────────────────────────────────────────────────────────────────

/**
 * One profile row plus the two counted signals → the engine's only input type.
 *
 * The English band still comes out of the existing loose `ielts_score` column
 * rather than a new numeric one: that column already holds real student data and
 * `parseEnglishBand` already has to cope with its looseness, so a second source of
 * truth for the same fact would be worse than a parser.
 */
export function toRoadmapInputs(profile: ProfileRow, signals: Signals): RoadmapInputs {
  const englishType = parseEnglishType(profile.english_test_type);
  const bookmarkCount = Math.max(0, Math.floor(Number(signals.bookmarkCount) || 0));
  const cvCount = Math.max(0, Math.floor(Number(signals.cvCount) || 0));

  return {
    degree: parseDegree(profile.target_degree),
    cgpa: parseCgpa(profile.cgpa),
    english: {
      type: englishType,
      band: parseEnglishBand(profile.ielts_score, englishType),
      status: parseEnglishStatus(profile.english_test_status),
      testDate: parseDateOnly(profile.english_test_date),
    },
    research: { papers: countFromProse(profile.published_papers) },
    experience: {
      workMonths: monthsFromProse(profile.work_experience),
      internshipMonths: monthsFromProse(profile.internships),
    },
    docs: normalizeDocs(profile.docs),
    bookmarkCount,
    hasCvRow: cvCount > 0,
    targetCountry: nonEmptyText(profile.target_country, 64),
    preferredCountries: splitCountries(profile.preferred_countries),
    intake: parseIntake(profile.target_intake_term, profile.target_intake_year),
    onboardedAt: parseTimestamp(profile.roadmap_onboarded_at),
  };
}

// ── The known/unknown rule ──────────────────────────────────────────────────

/**
 * The normative table, in code. It is load-bearing for honesty: a student who
 * answered "I haven't started IELTS" has a *known* English state, so
 * `no_english_test` is a fair weakness. A student who answered nothing has an
 * *unknown* English state, so it is only a Confidence gap.
 *
 * Exported so `scoring.ts` can set each pillar's `known` flag from the same
 * predicate that decides Confidence. Two copies of this table would eventually
 * disagree, and the disagreement would show up as a Weakness nobody earned.
 */
export function isInputKnown(inputs: RoadmapInputs, key: InputKey): boolean {
  switch (key) {
    case "degree":
      return inputs.degree !== null;
    case "cgpa":
      return inputs.cgpa !== null;
    case "english":
      return inputs.english.status !== null || inputs.english.band !== null;
    case "docs":
      return Object.values(inputs.docs).some((value) => value !== undefined && value !== null);
    case "research":
      // Including a declared 0 — that is the point of the parser returning null
      // for prose instead.
      return inputs.research.papers !== null;
    case "experience":
      return (
        inputs.experience.workMonths !== null || inputs.experience.internshipMonths !== null
      );
    case "target_country":
      return typeof inputs.targetCountry === "string" && inputs.targetCountry.trim() !== "";
    case "intake":
      return inputs.intake !== null;
  }
}

/** In `REQUIRED_INPUT_KEYS` order, so both lists are stable. */
export function knownInputs(inputs: RoadmapInputs): InputKey[] {
  return REQUIRED_INPUT_KEYS.filter((key) => isInputKnown(inputs, key));
}

export function unknownInputs(inputs: RoadmapInputs): InputKey[] {
  return REQUIRED_INPUT_KEYS.filter((key) => !isInputKnown(inputs, key));
}

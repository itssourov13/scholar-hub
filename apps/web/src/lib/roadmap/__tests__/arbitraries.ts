/**
 * Shared generators and helpers for the roadmap engine's property tests.
 *
 * Two generators do most of the work. `arbProfileRow()` produces the loose thing
 * the database actually holds — every field independently absent, `null`, empty,
 * valid, or prose — and is where the parser edge cases live. `arbRoadmapInputs()`
 * produces the normalized form directly, so the scoring properties are not
 * bottlenecked on the parser.
 *
 * The named edge cases are `fc.constantFrom` entries rather than hopes about what
 * random strings will find: `"3,65"`, `"IELTS 6.5 overall"`, `"2 published, 1
 * under review"`, `"জার্মানি"` are the values that actually broke something, so
 * they are generated on purpose.
 *
 * Not a test file — `*.test.ts` is what Vitest collects, and this is imported by
 * those. Task 3's graph and route properties import from here too.
 */

import fc from "fast-check";

import type { ProgressRow } from "../graph";
import type { ProfileRow, Signals } from "../inputs";
import type {
  DegreeLevel,
  DocStatus,
  EnglishTestStatus,
  EnglishTestType,
  InputKey,
  IntakeTerm,
  MilestoneKey,
  MilestoneStatus,
  RoadmapInputs,
} from "../types";

// ── Raw column values ───────────────────────────────────────────────────────

const DOC_STATUSES: readonly DocStatus[] = ["missing", "in_progress", "ready"];
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

/** Prose no parser can read as a number, and which declares nothing either.
 *  Deliberately excludes "none", "0", "N/A" and "fresher": those are *declared
 *  zeros*, which are known values, and mixing them in here would break the very
 *  distinction Property 8 exists to check. */
export const arbUnparseableProse = fc.constantFrom(
  "some conference work",
  "a fair bit",
  "will let you know",
  "quite a lot honestly",
  "planned",
  "will take in June",
  "in progress",
  "TBD",
  "ভালো অভিজ্ঞতা আছে",
  "still working on it",
);

/** Text that declares an absence. A known zero, never unknown. */
export const arbDeclaredZero = fc.constantFrom("none", "0", "No", "nil", "nothing", "N/A");

const arbCgpaRaw = fc.oneof(
  fc.constant(null),
  fc.constant(""),
  fc.constantFrom("3.65", 4.2, "N/A", "3,65", "2.75", 3.4, "3.10", "85", 0, "abc"),
  fc.integer({ min: 1, max: 500 }).map((n) => n / 100),
  arbUnparseableProse,
);

const arbIeltsRaw = fc.oneof(
  fc.constant(null),
  fc.constant(""),
  fc.constantFrom(
    "7.5",
    "IELTS 6.5 overall",
    "planned",
    "will take in June",
    "TOEFL 95",
    "TOEFL 92",
    "Duolingo 120",
    "PTE 65",
    6.5,
    "5.0",
  ),
  arbUnparseableProse,
);

const arbPapersRaw = fc.oneof(
  fc.constant(null),
  fc.constant(""),
  fc.constantFrom("none", "0", "2 published, 1 under review", "some conference work", 3, "1"),
  arbUnparseableProse,
  arbDeclaredZero,
);

const arbMonthsRaw = fc.oneof(
  fc.constant(null),
  fc.constant(""),
  fc.constantFrom(
    "2 years 6 months",
    "18 months",
    "fresher",
    "none",
    "3 years at Brac",
    "6 months internship",
    "36 months",
  ),
  arbUnparseableProse,
);

const arbPreferredRaw = fc.constantFrom(
  "",
  "Germany",
  "Germany, Canada",
  "জার্মানি",
  "USA / UK",
  "Japan and Canada",
  null,
);

const arbCountryRaw = fc.constantFrom(
  null,
  "",
  "Germany",
  "germany",
  " Canada ",
  "USA",
  "United Kingdom",
  "Japan",
  "Bhutan",
  "জার্মানি",
  "Germany, Canada",
);

const arbDocsRaw = fc.oneof(
  fc.constant(null),
  fc.dictionary(
    fc.constantFrom(
      "passport",
      "cv",
      "sop",
      "transcripts",
      "funding_proof",
      "aps",
      "blocked_account",
      "proof_of_funds",
      "lor_count",
      "from_a_newer_client",
    ),
    fc.oneof(
      fc.constantFrom(...DOC_STATUSES),
      fc.constantFrom("eventually", "READY"),
      fc.integer({ min: -2, max: 9 }),
    ),
    { maxKeys: 6 },
  ),
  // JSONB sometimes arrives as text through a driver or a fixture.
  fc.constant('{"passport":"ready","lor_count":2}'),
);

/**
 * The loose row shape. Every key is optional, so an absent column and a `null`
 * column are both generated — the two are different on the write side and must
 * behave identically on the read side.
 */
export function arbProfileRow(): fc.Arbitrary<ProfileRow> {
  return fc.record<ProfileRow>(
    {
      target_degree: fc.constantFrom(
        null,
        "",
        "masters",
        "Masters",
        "PhD",
        "Bachelor",
        "bsc",
        "diploma",
        "not sure yet",
      ),
      cgpa: arbCgpaRaw,
      ielts_score: arbIeltsRaw,
      english_test_type: fc.constantFrom(null, "", ...ENGLISH_TYPES, "IELTS"),
      english_test_status: fc.constantFrom(null, "", ...ENGLISH_STATUSES, "not started"),
      english_test_date: fc.constantFrom(null, "", "2026-03-12", "2026-03-12T00:00:00.000Z"),
      published_papers: arbPapersRaw,
      work_experience: arbMonthsRaw,
      internships: arbMonthsRaw,
      docs: arbDocsRaw,
      target_country: arbCountryRaw,
      preferred_countries: arbPreferredRaw,
      target_intake_term: fc.constantFrom(null, "", ...INTAKE_TERMS, "Fall", "autumn", "monsoon"),
      target_intake_year: fc.constantFrom(null, "", 2026, "2027", 2035, "soon"),
      roadmap_onboarded_at: fc.constantFrom(null, "", "2026-01-04T09:00:00.000Z"),
    },
    { requiredKeys: [] },
  );
}

export function arbSignals(): fc.Arbitrary<Signals> {
  return fc.record({
    bookmarkCount: fc.integer({ min: 0, max: 25 }),
    cvCount: fc.integer({ min: 0, max: 3 }),
  });
}

// ── Normalized inputs ───────────────────────────────────────────────────────

/** Band boundaries first, then a spread, so the generator lands on the edges of
 *  every scoring table rather than only near their middles. */
const arbCgpaValue = fc.oneof(
  fc.constantFrom(2.0, 2.74, 2.75, 2.99, 3.0, 3.24, 3.25, 3.4, 3.49, 3.5, 3.74, 3.75, 4.0, 4.2, 5.0),
  fc.integer({ min: 1, max: 500 }).map((n) => n / 100),
);

const arbBand = fc.constantFrom(4.0, 5.0, 5.4, 5.5, 5.9, 6.0, 6.4, 6.5, 6.9, 7.0, 7.4, 7.5, 8.0, 9.0);

export function arbDocs(): fc.Arbitrary<RoadmapInputs["docs"]> {
  return fc.record<RoadmapInputs["docs"]>(
    {
      passport: fc.constantFrom(...DOC_STATUSES),
      cv: fc.constantFrom(...DOC_STATUSES),
      sop: fc.constantFrom(...DOC_STATUSES),
      transcripts: fc.constantFrom(...DOC_STATUSES),
      funding_proof: fc.constantFrom(...DOC_STATUSES),
      aps: fc.constantFrom(...DOC_STATUSES),
      blocked_account: fc.constantFrom(...DOC_STATUSES),
      proof_of_funds: fc.constantFrom(...DOC_STATUSES),
      lor_count: fc.integer({ min: 0, max: 5 }),
    },
    { requiredKeys: [] },
  );
}

/** The normalized form, directly. Includes every degree level and `null`, and
 *  both halves of every "known" rule — a status with no band, a band with no
 *  status, an empty document map, a declared zero and an unknown alike. */
export function arbRoadmapInputs(): fc.Arbitrary<RoadmapInputs> {
  return fc.record<RoadmapInputs>({
    degree: fc.constantFrom<DegreeLevel | null>(null, "bachelor", "master", "phd"),
    cgpa: fc.oneof(
      fc.constant(null),
      fc.record({ value: arbCgpaValue, scale: fc.constantFrom<4 | 5>(4, 5) }),
    ),
    english: fc.record({
      type: fc.constantFrom<EnglishTestType | null>(null, ...ENGLISH_TYPES),
      band: fc.oneof(fc.constant(null), arbBand),
      status: fc.constantFrom<EnglishTestStatus | null>(null, ...ENGLISH_STATUSES),
      testDate: fc.constantFrom(null, "2026-03-12"),
    }),
    research: fc.record({
      papers: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 8 })),
    }),
    experience: fc.record({
      workMonths: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 60 })),
      internshipMonths: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 24 })),
    }),
    docs: arbDocs(),
    bookmarkCount: fc.integer({ min: 0, max: 25 }),
    hasCvRow: fc.boolean(),
    targetCountry: fc.constantFrom(
      null,
      "",
      "Germany",
      "germany",
      "Canada",
      "USA",
      "United Kingdom",
      "Japan",
      "Bhutan",
      "জার্মানি",
      "Germany, Canada",
    ),
    preferredCountries: fc.array(
      fc.constantFrom("Germany", "Canada", "USA", "UK", "Japan", "জার্মানি"),
      { maxLength: 3 },
    ),
    intake: fc.oneof(
      fc.constant(null),
      fc.record({
        term: fc.constantFrom(...INTAKE_TERMS),
        year: fc.integer({ min: 2025, max: 2035 }),
      }),
    ),
    onboardedAt: fc.constantFrom(null, "2026-01-04T09:00:00.000Z"),
  });
}

// ── Helpers the properties share ────────────────────────────────────────────

/** Give one input a known value, leaving everything else alone. Used to check
 *  that Confidence never falls when a student answers one more question. */
export function withKnownInput(inputs: RoadmapInputs, key: InputKey): RoadmapInputs {
  switch (key) {
    case "degree":
      return { ...inputs, degree: "master" };
    case "cgpa":
      return { ...inputs, cgpa: { value: 3.2, scale: 4 } };
    case "english":
      return { ...inputs, english: { ...inputs.english, status: "preparing" } };
    case "docs":
      return { ...inputs, docs: { ...inputs.docs, passport: "ready" } };
    case "research":
      return { ...inputs, research: { papers: 1 } };
    case "experience":
      return { ...inputs, experience: { ...inputs.experience, workMonths: 12 } };
    case "target_country":
      return { ...inputs, targetCountry: "Germany" };
    case "intake":
      return { ...inputs, intake: { term: "fall", year: 2026 } };
  }
}

/** Every leaf path at which two values differ, in dotted form. Arrays are
 *  compared positionally. Used to prove `satisfyEvidence` touched nothing but the
 *  evidence field it was asked about. */
export function diffPaths(a: unknown, b: unknown, prefix = ""): string[] {
  if (a === b) return [];
  const plain = (value: unknown) =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  if (Array.isArray(a) && Array.isArray(b)) {
    const paths: string[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      paths.push(...diffPaths(a[i], b[i], `${prefix}[${i}]`));
    }
    return paths;
  }
  if (plain(a) && plain(b)) {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    const paths: string[] = [];
    for (const key of keys) {
      paths.push(...diffPaths(left[key], right[key], prefix ? `${prefix}.${key}` : key));
    }
    return paths;
  }
  return [prefix || "<root>"];
}

/** A structurally identical value with every object's keys re-inserted in
 *  reverse order. Arrays keep their order, because a list's order is data. */
export function shuffleKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => shuffleKeys(entry)) as unknown as T;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).reverse();
    const out: Record<string, unknown> = {};
    for (const [key, entry] of entries) out[key] = shuffleKeys(entry);
    return out as T;
  }
  return value;
}

// ── Stored progress, writes and clocks (task 3) ──────────────────────────────

/** Every key any path can contain, plus two a newer or older engine version
 *  might have stored. A stored key outside the current path must be ignored
 *  rather than crash the merge (Req 11.7). */
export const ALL_MILESTONE_KEYS: readonly MilestoneKey[] = [
  "profile_basics",
  "target_choice",
  "passport",
  "english_test",
  "transcripts",
  "cv",
  "sop",
  "lor",
  "shortlist",
  "funding_plan",
  "apply",
  "visa",
  "aps_germany",
  "blocked_account_germany",
  "proof_of_funds_canada",
  "pal_canada",
  "i20_usa",
  "ds160_usa",
  "cas_uk",
  "ihs_uk",
  "professor_contact_japan",
  "coe_japan",
];

const MILESTONE_STATUSES: readonly MilestoneStatus[] = ["todo", "in_progress", "done", "skipped"];

/** Keys a client could send that no catalog entry declares. */
export const arbUnknownMilestoneKey = fc.constantFrom(
  "retired_key_from_v0",
  "aps_austria",
  "",
  "../../etc/passwd",
);

/** Stored `milestone_progress` rows, including keys outside every path, both
 *  override states, and a `progress` value that may exceed any target count. */
export function arbProgressRows(): fc.Arbitrary<ProgressRow[]> {
  return fc
    .uniqueArray(
      fc.oneof(
        { weight: 9, arbitrary: fc.constantFrom(...ALL_MILESTONE_KEYS) },
        { weight: 1, arbitrary: arbUnknownMilestoneKey },
      ),
      { maxLength: 12 },
    )
    .chain((keys) =>
      fc.tuple(
        ...keys.map((key) =>
          fc.record<ProgressRow>({
            milestone_key: fc.constant(key),
            status: fc.constantFrom(...MILESTONE_STATUSES),
            progress: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 5 })),
            manual_override: fc.boolean(),
            completed_at: fc.constantFrom(null, "2026-02-01T00:00:00.000Z"),
            celebrated_at: fc.constantFrom(null, "2026-02-01T00:00:00.000Z"),
          }),
        ),
      ),
    )
    .map((rows) => [...rows]);
}

/** A sequence of status and progress writes over arbitrary keys, in any order,
 *  including repeats and keys no path contains. */
export function arbWriteSequence(): fc.Arbitrary<
  { key: string; status: MilestoneStatus; progress: number | null }[]
> {
  return fc.array(
    fc.record({
      key: fc.oneof(
        { weight: 9, arbitrary: fc.constantFrom<string>(...ALL_MILESTONE_KEYS) },
        { weight: 1, arbitrary: arbUnknownMilestoneKey },
      ),
      status: fc.constantFrom(...MILESTONE_STATUSES),
      progress: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 5 })),
    }),
    { maxLength: 20 },
  );
}

/** Instants spread across the years the intake columns allow, so due dates land
 *  before, inside and after a stored intake. */
export function arbNow(): fc.Arbitrary<number> {
  return fc.integer({
    min: Date.UTC(2024, 0, 1),
    max: Date.UTC(2032, 11, 31),
  });
}

/** Country spellings no alias list holds, so the Generic_Path is the only
 *  honest answer. */
export const arbUnmatchedCountry = fc.oneof(
  fc.constantFrom(
    null,
    "",
    "   ",
    "Bhutan",
    "জার্মানি",
    "Germany, Canada",
    "USA / UK",
    "germany ish",
    "🇩🇪",
    "United Statesx",
  ),
  fc.string({ maxLength: 24 }),
);

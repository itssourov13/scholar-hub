/**
 * The six persona fixtures, with every number computed by hand from the tables in
 * the design rather than captured from a run.
 *
 * That direction matters: these are the readable end of the engine's test suite,
 * and a fixture whose expectations were copied out of the implementation proves
 * only that the implementation is self-consistent. Each `expected` block below can
 * be checked against the design's weight table, band tables and document bucket
 * table with a pencil.
 *
 * The `graph` block on a persona holds the expectations that belong to task 3 —
 * path membership, feasibility, the roll-forward — so that the fixture stays one
 * object and task 3 extends it rather than restating it.
 */

import type {
  DegreeLevel,
  Feasibility,
  InputKey,
  IntakeTerm,
  MilestoneKey,
  PillarKey,
  RoadmapInputs,
  StrengthKey,
  WeaknessKey,
} from "../types";

export type PillarExpectation = { earned: number; available: number; known: boolean };

export type Persona = {
  name: string;
  /** Why this fixture exists at all. */
  note: string;
  inputs: RoadmapInputs;
  expected: {
    weighting: DegreeLevel;
    knownInputs: readonly InputKey[];
    confidence: number;
    highestWeightUnknown: InputKey | null;
    pillars: Record<PillarKey, PillarExpectation>;
    earned: number;
    readiness: number | null;
    strengths: readonly StrengthKey[];
    weaknesses: readonly { key: WeaknessKey; pointsAtStake: number }[];
  };
  /** Task 3's half of the fixture. Nothing in task 2 reads this. */
  graph?: {
    pathIncludes?: readonly MilestoneKey[];
    countrySource?: "rules" | "generic";
    feasibility?: Feasibility;
    suggestedIntake?: { term: IntakeTerm; year: "next" };
    entryPoint?: "wizard" | "journey";
  };
};

/** All eight student-supplied inputs unknown. The starting point every fixture
 *  spreads from, so a fixture only states what it actually sets. */
export function emptyInputs(): RoadmapInputs {
  return {
    degree: null,
    cgpa: null,
    english: { type: null, band: null, status: null, testDate: null },
    research: { papers: null },
    experience: { workMonths: null, internshipMonths: null },
    docs: {},
    bookmarkCount: 0,
    hasCvRow: false,
    targetCountry: null,
    preferredCountries: [],
    intake: null,
    onboardedAt: null,
  };
}

const MASTER_AVAILABLE: Record<PillarKey, number> = {
  academics: 20,
  english: 20,
  documents: 25,
  research: 15,
  experience: 10,
  application_progress: 10,
};

const PHD_AVAILABLE: Record<PillarKey, number> = {
  academics: 15,
  english: 15,
  documents: 20,
  research: 30,
  experience: 10,
  application_progress: 10,
};

/** `earned` and `known` per pillar against a fixed availability column. */
function pillars(
  available: Record<PillarKey, number>,
  earned: Record<PillarKey, number>,
  known: Record<PillarKey, boolean>,
): Record<PillarKey, PillarExpectation> {
  return {
    academics: { earned: earned.academics, available: available.academics, known: known.academics },
    english: { earned: earned.english, available: available.english, known: known.english },
    documents: { earned: earned.documents, available: available.documents, known: known.documents },
    research: { earned: earned.research, available: available.research, known: known.research },
    experience: {
      earned: earned.experience,
      available: available.experience,
      known: known.experience,
    },
    application_progress: {
      earned: earned.application_progress,
      available: available.application_progress,
      known: known.application_progress,
    },
  };
}

// ── 1. Empty ────────────────────────────────────────────────────────────────

const empty: Persona = {
  name: "Empty",
  note: "Nothing set. Confidence 0, no number, no diagnosis, and the wizard as the entry point.",
  inputs: emptyInputs(),
  expected: {
    weighting: "master", // unknown degree applies the master column
    knownInputs: [],
    confidence: 0,
    // Documents carries the most available points (25) of any unknown input.
    highestWeightUnknown: "docs",
    pillars: pillars(
      MASTER_AVAILABLE,
      {
        academics: 0,
        english: 0,
        documents: 0,
        research: 0,
        experience: 0,
        application_progress: 0,
      },
      {
        academics: false,
        english: false,
        documents: false,
        research: false,
        experience: false,
        // 0 bookmarks is a fact, not a gap.
        application_progress: true,
      },
    ),
    earned: 0,
    readiness: null,
    strengths: [],
    weaknesses: [],
  },
  graph: { countrySource: "generic", entryPoint: "wizard" },
};

// ── 2. Wizard just finished ─────────────────────────────────────────────────

const wizardJustFinished: Persona = {
  name: "Wizard just finished",
  note:
    "The fixture the readiness gate exists for. Four known inputs clear the Confidence " +
    "floor at 50, the pillars sum to 6, and readiness is still null — without the gate " +
    "this persona reads 'you are 6% ready' immediately after answering every question " +
    "the app asked.",
  inputs: {
    ...emptyInputs(),
    english: { type: null, band: null, status: "not_started", testDate: null },
    docs: { passport: "ready" },
    bookmarkCount: 2,
    targetCountry: "Germany",
    intake: { term: "fall", year: 2026 },
    onboardedAt: "2026-01-04T09:00:00.000Z",
  },
  expected: {
    weighting: "master",
    knownInputs: ["english", "docs", "target_country", "intake"],
    confidence: 50, // round(100 × 4 / 8)
    // Both gate inputs are unknown and both feed academics (20); the tie breaks on
    // REQUIRED_INPUT_KEYS order, so `degree` is named. The client's unlock copy
    // names CGPA, which only ever renders while readiness is null — the caption
    // that reads this field renders only once the gate is open.
    highestWeightUnknown: "degree",
    pillars: pillars(
      MASTER_AVAILABLE,
      {
        academics: 0,
        english: 0, // status known, band unknown → share 0
        documents: 3, // passport ready
        research: 0,
        experience: 0,
        application_progress: 3, // 2 bookmarks
      },
      {
        academics: false,
        english: true, // "I haven't started" is a known state
        documents: true,
        research: false,
        experience: false,
        application_progress: true,
      },
    ),
    earned: 6,
    readiness: null, // floor cleared, gate shut
    strengths: [], // nothing reaches 0.70
    weaknesses: [], // no diagnosis while readiness is null
  },
  graph: {
    pathIncludes: ["aps_germany", "blocked_account_germany"],
    countrySource: "rules",
    entryPoint: "journey",
  },
};

// ── 3. Fresh graduate, Germany ──────────────────────────────────────────────

const freshGraduateGermany: Persona = {
  name: "Fresh graduate, Germany",
  note:
    "The gate opens. Academics sits exactly on the 0.70 strength boundary, and the " +
    "weakness list shows the one-per-pillar cap doing its job: Documents contributes " +
    "no_cv alone, not four entries.",
  inputs: {
    ...emptyInputs(),
    degree: "master",
    cgpa: { value: 3.4, scale: 4 },
    english: { type: null, band: null, status: "not_started", testDate: null },
    docs: { passport: "ready" },
    bookmarkCount: 1,
    targetCountry: "Germany",
    intake: { term: "fall", year: 2026 },
  },
  expected: {
    weighting: "master",
    knownInputs: ["degree", "cgpa", "english", "docs", "target_country", "intake"],
    confidence: 75, // round(100 × 6 / 8)
    highestWeightUnknown: "research", // research 15 beats experience 10
    pillars: pillars(
      MASTER_AVAILABLE,
      {
        academics: 14, // 3.40 normalised → band 3.25-3.49 → 0.70 → round(20 × 0.70)
        english: 0,
        documents: 3, // passport ready
        research: 0,
        experience: 0,
        application_progress: 3, // 1 bookmark
      },
      {
        academics: true,
        english: true,
        documents: true,
        research: false,
        experience: false,
        application_progress: true,
      },
    ),
    earned: 20,
    readiness: 20,
    strengths: ["strong_cgpa"], // 14/20 = 0.70, exactly on the boundary
    weaknesses: [
      // Documents: cv and sop both gate 6 points, so the key breaks the tie.
      { key: "no_cv", pointsAtStake: 22 },
      { key: "no_english_test", pointsAtStake: 20 },
      { key: "empty_shortlist", pointsAtStake: 7 },
      // …and nothing from research or experience, which are unknown rather than
      // deficient.
    ],
  },
  graph: {
    pathIncludes: ["aps_germany", "blocked_account_germany"],
    countrySource: "rules",
    entryPoint: "journey",
  },
};

// ── 4. Strong PhD applicant, Generic ────────────────────────────────────────

const strongPhdGeneric: Persona = {
  name: "Strong PhD applicant, Generic",
  note:
    "Four pillars clear the strength threshold and the three-entry cap drops the " +
    "smallest, which is what makes the pillar-weight-then-key tie-break observable: " +
    "every candidate has 0 points at stake.",
  inputs: {
    ...emptyInputs(),
    degree: "phd",
    cgpa: { value: 3.85, scale: 4 },
    english: { type: "ielts", band: 7.5, status: "scored", testDate: null },
    research: { papers: 3 },
    docs: { cv: "ready", sop: "in_progress", transcripts: "ready", lor_count: 3 },
    bookmarkCount: 12,
    intake: { term: "fall", year: 2026 },
  },
  expected: {
    weighting: "phd",
    knownInputs: ["degree", "cgpa", "english", "docs", "research", "intake"],
    confidence: 75,
    highestWeightUnknown: "experience", // experience 10 beats target_country's 0
    pillars: pillars(
      PHD_AVAILABLE,
      {
        academics: 15, // 3.85 ≥ 3.75 → 1.00
        english: 15, // band 7.5 → 1.00
        // cv 5 + sop floor(5/2)=2 + transcripts 3 + lor 3 = 13. passport absent,
        // and the generic country_docs bucket wants funding_proof.
        documents: 13,
        research: 30, // 3 papers → 1.00
        experience: 0,
        application_progress: 10, // 12 bookmarks
      },
      {
        academics: true,
        english: true,
        documents: true,
        research: true,
        experience: false,
        application_progress: true,
      },
    ),
    earned: 83,
    readiness: 83,
    // All four candidates have 0 at stake, so pillar weight decides: research 30,
    // then academics and english tie at 15 and the key breaks it, then
    // active_shortlist is dropped by the cap. Documents is 13/20 = 0.65, just
    // under the threshold.
    strengths: ["research_output", "strong_cgpa", "strong_english"],
    // The one absent Evidence_Requirement on a known pillar: the SOP is in
    // progress rather than ready. `no_cv` does not fire — docs.cv is "ready",
    // which the Documents pillar was already paid for.
    weaknesses: [{ key: "no_sop", pointsAtStake: 7 }],
  },
  graph: { countrySource: "generic", entryPoint: "journey" },
};

// ── 5. Career switcher, Canada ──────────────────────────────────────────────

const careerSwitcherCanada: Persona = {
  name: "Career switcher, Canada",
  note:
    "Two weaknesses, not four: an empty document map and unparseable publication " +
    "prose are Confidence gaps, so neither pillar is allowed to accuse. The CGPA " +
    "arrives on a 5-point scale, which the fixture states rather than leaves to the " +
    "parser's magnitude heuristic.",
  inputs: {
    ...emptyInputs(),
    degree: "master",
    cgpa: { value: 3.1, scale: 5 },
    english: { type: "toefl", band: 6.5, status: "scored", testDate: null }, // TOEFL 92
    experience: { workMonths: 36, internshipMonths: null },
    targetCountry: "Canada",
    intake: { term: "fall", year: 2026 },
  },
  expected: {
    weighting: "master",
    knownInputs: ["degree", "cgpa", "english", "experience", "target_country", "intake"],
    confidence: 75,
    highestWeightUnknown: "docs", // documents 25 beats research 15
    pillars: pillars(
      MASTER_AVAILABLE,
      {
        academics: 5, // 3.10/5 → 2.48 normalised → < 2.75 → 0.25 → round(20 × 0.25)
        english: 15, // band 6.5 → 0.75
        documents: 0,
        research: 0,
        experience: 10, // 36 months → 1.00
        application_progress: 0, // no bookmarks
      },
      {
        academics: true,
        english: true,
        documents: false, // the Docs_Map is empty
        research: false, // unparseable prose
        experience: true,
        application_progress: true,
      },
    ),
    earned: 30,
    readiness: 30,
    strengths: ["strong_english", "work_experience"], // 5 at stake, then 0
    weaknesses: [
      { key: "low_cgpa", pointsAtStake: 15 },
      { key: "empty_shortlist", pointsAtStake: 10 },
    ],
  },
  graph: { countrySource: "rules", entryPoint: "journey" },
};

// ── 6. Past intake ──────────────────────────────────────────────────────────

const pastIntake: Persona = {
  name: "Past intake",
  note:
    "Every input known, so the gate is open and the score is reported. The reason " +
    "this persona exists is the feasibility roll-forward, which lives in task 3; the " +
    "scoring half is asserted here so the two halves cannot drift.",
  inputs: {
    ...emptyInputs(),
    degree: "master",
    cgpa: { value: 3.5, scale: 4 },
    english: { type: "ielts", band: 6.5, status: "scored", testDate: null },
    research: { papers: 1 },
    experience: { workMonths: 12, internshipMonths: null },
    docs: { passport: "ready", transcripts: "ready" },
    bookmarkCount: 4,
    targetCountry: "Germany",
    intake: { term: "fall", year: 2024 }, // already started
  },
  expected: {
    weighting: "master",
    knownInputs: [
      "degree",
      "cgpa",
      "english",
      "docs",
      "research",
      "experience",
      "target_country",
      "intake",
    ],
    confidence: 100,
    highestWeightUnknown: null,
    pillars: pillars(
      MASTER_AVAILABLE,
      {
        academics: 17, // 3.50 → 0.85 → round(20 × 0.85)
        english: 15, // band 6.5 → 0.75
        documents: 7, // passport 3 + transcripts 4; Germany's country docs absent
        research: 8, // 1 paper → 0.50 → round(15 × 0.50) = round(7.5)
        experience: 8, // 12 months → 0.80
        application_progress: 6, // 4 bookmarks
      },
      {
        academics: true,
        english: true,
        documents: true,
        research: true,
        experience: true,
        application_progress: true,
      },
    ),
    earned: 61,
    readiness: 61,
    strengths: ["strong_english", "strong_cgpa", "work_experience"], // 5, 3, 2 at stake
    weaknesses: [{ key: "no_cv", pointsAtStake: 18 }],
  },
  graph: {
    pathIncludes: ["aps_germany", "blocked_account_germany"],
    countrySource: "rules",
    feasibility: "not-feasible",
    suggestedIntake: { term: "fall", year: "next" },
    entryPoint: "journey",
  },
};

export const PERSONAS: readonly Persona[] = [
  empty,
  wizardJustFinished,
  freshGraduateGermany,
  strongPhdGeneric,
  careerSwitcherCanada,
  pastIntake,
];

export function personaByName(name: string): Persona {
  const found = PERSONAS.find((persona) => persona.name === name);
  if (!found) throw new Error(`No persona fixture named "${name}"`);
  return found;
}

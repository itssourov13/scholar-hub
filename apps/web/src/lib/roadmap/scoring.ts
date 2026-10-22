/**
 * Six pillars, one hundred points, and the readiness gate.
 *
 * Two rules shape everything here.
 *
 * **A status write cannot move the score.** `scoreProfile` takes `RoadmapInputs`
 * and nothing else, and `RoadmapInputs` has no field derived from
 * `milestone_progress`. The anti-gaming rule is therefore a consequence of this
 * module's signature rather than a check somebody could forget.
 *
 * **Unknown is not zero.** A pillar whose inputs are unparseable or absent reports
 * `known: false`, earns 0, and is barred from producing a Weakness. It costs
 * Confidence instead. And below the readiness gate the engine reports no number at
 * all: a profile it cannot score is a profile it must not diagnose.
 *
 * Every band below is absolute so a fixture can be computed by hand.
 *
 * Pure: no I/O, no clock.
 */

import { evidenceFor, countryDocKeysFor, type DocBucket } from "./evidence";
import { REQUIRED_INPUT_KEYS, isInputKnown, knownInputs, unknownInputs } from "./inputs";
import {
  CONFIDENCE_FLOOR,
  READINESS_GATE_INPUTS,
  type Bilingual,
  type DegreeLevel,
  type DerivedNote,
  type DocKey,
  type DocStatus,
  type InputKey,
  type MilestoneKey,
  type PillarKey,
  type RoadmapInputs,
  type StrengthKey,
  type WeaknessKey,
} from "./types";

export type PillarScore = {
  pillar: PillarKey;
  earned: number;
  available: number;
  /** `false` ⇒ this pillar cannot yield a Weakness. Mirrors the pillar's
   *  `InputKey`, so the two can never drift apart. */
  known: boolean;
  /** "3.65 / 4.00 CGPA" — derived, never AI. */
  detail: Bilingual;
};

export type ScoreBreakdown = {
  weighting: DegreeLevel;
  pillars: PillarScore[]; // always six, fixed order
  earned: number; // = Σ pillars.earned
  confidence: number; // 0-100
  unknownInputs: InputKey[];
  highestWeightUnknown: InputKey | null;
};

/** The six pillars, in the order every breakdown reports them. */
export const PILLAR_ORDER: readonly PillarKey[] = [
  "academics",
  "english",
  "documents",
  "research",
  "experience",
  "application_progress",
];

/** Every column sums to 100, so the available points total 100 whatever the
 *  degree. An unknown degree uses the `master` column, which is the baseline. */
export const PILLAR_WEIGHTS: Record<DegreeLevel, Record<PillarKey, number>> = {
  bachelor: {
    academics: 25,
    english: 25,
    documents: 25,
    research: 5,
    experience: 10,
    application_progress: 10,
  },
  master: {
    academics: 20,
    english: 20,
    documents: 25,
    research: 15,
    experience: 10,
    application_progress: 10,
  },
  phd: {
    academics: 15,
    english: 15,
    documents: 20,
    research: 30,
    experience: 10,
    application_progress: 10,
  },
};

/** The Documents pillar split into six buckets, declared per column as integers
 *  rather than scaled at runtime so a fixture stays hand-computable. Each column
 *  sums to that column's `documents` weight. */
export const DOC_BUCKET_WEIGHTS: Record<DegreeLevel, Record<DocBucket, number>> = {
  bachelor: { passport: 3, cv: 6, sop: 6, transcripts: 4, lor: 4, country_docs: 2 },
  master: { passport: 3, cv: 6, sop: 6, transcripts: 4, lor: 4, country_docs: 2 },
  phd: { passport: 2, cv: 5, sop: 5, transcripts: 3, lor: 3, country_docs: 2 },
};

export const DOC_BUCKET_ORDER: readonly DocBucket[] = [
  "passport",
  "cv",
  "sop",
  "transcripts",
  "lor",
  "country_docs",
];

/** The degree weighting an unknown `target_degree` falls back to. */
export const DEFAULT_WEIGHTING: DegreeLevel = "master";

/** Which pillar each student-supplied input feeds, for `highestWeightUnknown`.
 *  `target_country` and `intake` earn no points directly — they shape the path —
 *  so they carry no pillar and rank last. `degree` is filed under academics: it
 *  selects the weighting column and is an academic fact. */
const INPUT_PILLARS: Record<InputKey, PillarKey | null> = {
  degree: "academics",
  cgpa: "academics",
  english: "english",
  docs: "documents",
  research: "research",
  experience: "experience",
  target_country: null,
  intake: null,
};

type Band = readonly (readonly [floor: number, share: number])[];

function shareFrom(bands: Band, value: number): number {
  for (const [floor, share] of bands) if (value >= floor) return share;
  return bands[bands.length - 1][1];
}

const UNKNOWN_DETAIL: Bilingual = { en: "Not enough info yet", bn: "এখনও পর্যাপ্ত তথ্য নেই" };

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Academics ───────────────────────────────────────────────────────────────

/** Normalised to a 4.0 scale as `value / scale × 4`. */
const ACADEMIC_BANDS: Band = [
  [3.75, 1.0],
  [3.5, 0.85],
  [3.25, 0.7],
  [3.0, 0.55],
  [2.75, 0.4],
  [0, 0.25],
];

export function scoreAcademics(inputs: RoadmapInputs, weighting: DegreeLevel): PillarScore {
  const available = PILLAR_WEIGHTS[weighting].academics;
  const known = isInputKnown(inputs, "cgpa");
  if (!inputs.cgpa) {
    return { pillar: "academics", earned: 0, available, known, detail: UNKNOWN_DETAIL };
  }
  const { value, scale } = inputs.cgpa;
  const normalized = round2((value / scale) * 4);
  const earned = Math.round(available * shareFrom(ACADEMIC_BANDS, normalized));
  const shown = `${value.toFixed(2)} / ${scale.toFixed(2)}`;
  return {
    pillar: "academics",
    earned,
    available,
    known,
    detail: { en: `${shown} CGPA`, bn: `সিজিপিএ ${shown}` },
  };
}

// ── English ─────────────────────────────────────────────────────────────────

const ENGLISH_BANDS: Band = [
  [7.5, 1.0],
  [7.0, 0.9],
  [6.5, 0.75],
  [6.0, 0.6],
  [5.5, 0.4],
  [0, 0.2],
];

const ENGLISH_STATUS_DETAIL: Record<string, Bilingual> = {
  not_started: { en: "Test not started", bn: "টেস্ট শুরু হয়নি" },
  preparing: { en: "Preparing for the test", bn: "টেস্টের প্রস্তুতি চলছে" },
  booked: { en: "Test booked", bn: "টেস্টের তারিখ নেওয়া হয়েছে" },
  taken: { en: "Test taken, score pending", bn: "টেস্ট দেওয়া হয়েছে, স্কোর বাকি" },
  scored: { en: "Score in hand", bn: "স্কোর হাতে আছে" },
  waived: { en: "English requirement waived", bn: "ইংরেজি শর্ত মাফ" },
};

const WAIVED_DETAIL: Bilingual = ENGLISH_STATUS_DETAIL.waived;

/** A declared waiver — Medium of Instruction, or an outright waiver — is full
 *  credit: the requirement is met, there is no band to report. */
export function isEnglishWaived(inputs: RoadmapInputs): boolean {
  return (
    inputs.english.type === "moi" ||
    inputs.english.type === "waiver" ||
    inputs.english.status === "waived"
  );
}

export function scoreEnglish(inputs: RoadmapInputs, weighting: DegreeLevel): PillarScore {
  const available = PILLAR_WEIGHTS[weighting].english;
  // Mirrors the `english` InputKey exactly: status known *or* band known. A
  // waiver declared through `type` alone therefore earns the points while still
  // reporting `known: false`, because the student has told us nothing else.
  const known = isInputKnown(inputs, "english");

  if (isEnglishWaived(inputs)) {
    return { pillar: "english", earned: available, available, known, detail: WAIVED_DETAIL };
  }
  if (inputs.english.band !== null) {
    const earned = Math.round(available * shareFrom(ENGLISH_BANDS, inputs.english.band));
    return {
      pillar: "english",
      earned,
      available,
      known,
      detail: {
        en: `IELTS-equivalent band ${inputs.english.band}`,
        bn: `IELTS সমতুল্য ব্যান্ড ${inputs.english.band}`,
      },
    };
  }
  // Band unknown. Status known keeps `known: true` — "I haven't started" is a
  // fact about the student, and a fair Weakness.
  const detail = inputs.english.status
    ? ENGLISH_STATUS_DETAIL[inputs.english.status]
    : UNKNOWN_DETAIL;
  return { pillar: "english", earned: 0, available, known, detail };
}

// ── Documents ───────────────────────────────────────────────────────────────

function statusCredit(
  points: number,
  status: DocStatus | undefined,
  alreadyFull = false,
): { points: number; full: boolean } {
  if (alreadyFull || status === "ready") return { points, full: true };
  if (status === "in_progress") return { points: Math.floor(points / 2), full: false };
  return { points: 0, full: false };
}

export function scoreDocuments(inputs: RoadmapInputs, weighting: DegreeLevel): PillarScore {
  const available = PILLAR_WEIGHTS[weighting].documents;
  const buckets = DOC_BUCKET_WEIGHTS[weighting];
  const known = isInputKnown(inputs, "docs");

  const credits = [
    statusCredit(buckets.passport, inputs.docs.passport),
    // A CV in the builder counts, and so does a self-reported ready CV: both are
    // stored values, which is what the score is allowed to read.
    statusCredit(buckets.cv, inputs.docs.cv, inputs.hasCvRow),
    statusCredit(buckets.sop, inputs.docs.sop),
    statusCredit(buckets.transcripts, inputs.docs.transcripts),
  ];

  const lorCount = inputs.docs.lor_count ?? 0;
  const lorShare = lorCount >= 3 ? 1 : lorCount === 2 ? 0.75 : lorCount === 1 ? 0.5 : 0;
  credits.push({ points: Math.floor(buckets.lor * lorShare), full: lorShare === 1 });

  // Every country's extra documents land in this one bucket, which is what keeps
  // the pillar total fixed at 25 (20 for a PhD) whatever the country.
  const required = countryDocKeysFor(inputs.targetCountry).filter(
    (key): key is Exclude<DocKey, "lor_count"> => key !== "lor_count",
  );
  const ready = required.filter((key) => inputs.docs[key] === "ready").length;
  const fraction = required.length === 0 ? 1 : ready / required.length;
  credits.push({
    points: fraction === 1 ? buckets.country_docs : Math.floor(buckets.country_docs * fraction),
    full: fraction === 1,
  });

  const earned = credits.reduce((sum, credit) => sum + credit.points, 0);
  const fullCount = credits.filter((credit) => credit.full).length;
  return {
    pillar: "documents",
    earned,
    available,
    known,
    detail: known
      ? {
          en: `${fullCount} of ${credits.length} document items ready`,
          bn: `${credits.length}টির মধ্যে ${fullCount}টি ডকুমেন্ট প্রস্তুত`,
        }
      : UNKNOWN_DETAIL,
  };
}

// ── Research ────────────────────────────────────────────────────────────────

export function scoreResearch(inputs: RoadmapInputs, weighting: DegreeLevel): PillarScore {
  const available = PILLAR_WEIGHTS[weighting].research;
  const known = isInputKnown(inputs, "research");
  const papers = inputs.research.papers;
  if (papers === null) {
    return { pillar: "research", earned: 0, available, known, detail: UNKNOWN_DETAIL };
  }
  const share = papers >= 3 ? 1 : papers === 2 ? 0.75 : papers === 1 ? 0.5 : 0;
  return {
    pillar: "research",
    earned: Math.round(available * share),
    available,
    known,
    detail:
      papers === 0
        ? { en: "No papers yet", bn: "এখনও কোনো পেপার নেই" }
        : { en: `${papers} paper${papers === 1 ? "" : "s"}`, bn: `${papers}টি পেপার` },
  };
}

// ── Experience ──────────────────────────────────────────────────────────────

const EXPERIENCE_BANDS: Band = [
  [24, 1.0],
  [12, 0.8],
  [6, 0.6],
  [1, 0.4],
  [0, 0],
];

export function scoreExperience(inputs: RoadmapInputs, weighting: DegreeLevel): PillarScore {
  const available = PILLAR_WEIGHTS[weighting].experience;
  const known = isInputKnown(inputs, "experience");
  if (!known) {
    return { pillar: "experience", earned: 0, available, known, detail: UNKNOWN_DETAIL };
  }
  const months = (inputs.experience.workMonths ?? 0) + (inputs.experience.internshipMonths ?? 0);
  return {
    pillar: "experience",
    earned: Math.round(available * shareFrom(EXPERIENCE_BANDS, months)),
    available,
    known,
    detail:
      months === 0
        ? { en: "No experience yet", bn: "এখনও কোনো অভিজ্ঞতা নেই" }
        : { en: `${months} months of experience`, bn: `${months} মাসের অভিজ্ঞতা` },
  };
}

// ── Application progress ────────────────────────────────────────────────────

/** Bookmark count only: nothing in the schema stores a submitted application.
 *  Absolute points at the standard 10 available; non-decreasing by construction. */
const BOOKMARK_BANDS: Band = [
  [10, 10],
  [6, 8],
  [3, 6],
  [1, 3],
  [0, 0],
];

export function scoreApplicationProgress(
  inputs: RoadmapInputs,
  weighting: DegreeLevel,
): PillarScore {
  const available = PILLAR_WEIGHTS[weighting].application_progress;
  const count = Math.max(0, Math.floor(inputs.bookmarkCount));
  const points = shareFrom(BOOKMARK_BANDS, count);
  return {
    pillar: "application_progress",
    earned: Math.round((points * available) / 10),
    available,
    // Always true: 0 bookmarks is a fact, not a gap.
    known: true,
    detail:
      count === 0
        ? { en: "No scholarships saved yet", bn: "এখনও কোনো স্কলারশিপ সংরক্ষিত নয়" }
        : {
            en: `${count} scholarship${count === 1 ? "" : "s"} saved`,
            bn: `${count}টি স্কলারশিপ সংরক্ষিত`,
          },
  };
}

// ── The breakdown ───────────────────────────────────────────────────────────

function highestWeightUnknownOf(unknown: InputKey[], weighting: DegreeLevel): InputKey | null {
  let best: InputKey | null = null;
  let bestWeight = -1;
  // Iterating in REQUIRED_INPUT_KEYS order with a strict `>` makes the earlier
  // key win a tie, which is the documented tie-break.
  for (const key of REQUIRED_INPUT_KEYS) {
    if (!unknown.includes(key)) continue;
    const pillar = INPUT_PILLARS[key];
    const weight = pillar ? PILLAR_WEIGHTS[weighting][pillar] : 0;
    if (weight > bestWeight) {
      best = key;
      bestWeight = weight;
    }
  }
  return best;
}

export function scoreProfile(inputs: RoadmapInputs): ScoreBreakdown {
  const weighting = inputs.degree ?? DEFAULT_WEIGHTING;
  const pillars: PillarScore[] = [
    scoreAcademics(inputs, weighting),
    scoreEnglish(inputs, weighting),
    scoreDocuments(inputs, weighting),
    scoreResearch(inputs, weighting),
    scoreExperience(inputs, weighting),
    scoreApplicationProgress(inputs, weighting),
  ];
  const unknown = unknownInputs(inputs);
  return {
    weighting,
    pillars,
    earned: pillars.reduce((sum, pillar) => sum + pillar.earned, 0),
    confidence: Math.round((100 * knownInputs(inputs).length) / REQUIRED_INPUT_KEYS.length),
    unknownInputs: unknown,
    highestWeightUnknown: highestWeightUnknownOf(unknown, weighting),
  };
}

/**
 * An integer only when both hold:
 *
 *   * `confidence >= CONFIDENCE_FLOOR`
 *   * every key in `READINESS_GATE_INPUTS` is absent from `unknownInputs`
 *
 * `null` otherwise. A profile carrying only the four answers the wizard collects
 * clears the floor at Confidence 50 and still reports `null` rather than the 6
 * its pillars would sum to — "you are 6% ready", handed to a student who just
 * answered every question the app asked, is worse than no number at all.
 */
export function readinessOf(breakdown: ScoreBreakdown): number | null {
  if (breakdown.confidence < CONFIDENCE_FLOOR) return null;
  for (const key of READINESS_GATE_INPUTS) {
    if (breakdown.unknownInputs.includes(key)) return null;
  }
  return Math.max(0, Math.min(100, Math.round(breakdown.earned)));
}

// ── Strengths and weaknesses ────────────────────────────────────────────────

const STRENGTH_THRESHOLD = 0.7;
const WEAKNESS_THRESHOLD = 0.3;

const STRENGTH_KEYS: Record<PillarKey, StrengthKey> = {
  academics: "strong_cgpa",
  english: "strong_english",
  documents: "documents_ready",
  research: "research_output",
  experience: "work_experience",
  application_progress: "active_shortlist",
};

/** The Weakness that names the pillar as a whole, used when no evidence-named
 *  candidate applies. English only reaches `weak_english_band` when a band exists
 *  — an absent band is the evidence-named `no_english_test`. */
const GENERIC_WEAKNESS: Record<PillarKey, WeaknessKey> = {
  academics: "low_cgpa",
  english: "weak_english_band",
  documents: "missing_documents",
  research: "no_research",
  experience: "no_experience",
  application_progress: "empty_shortlist",
};

/** Every Weakness carries the milestone that resolves it. */
export const WEAKNESS_RESOLVER: Record<WeaknessKey, MilestoneKey> = {
  low_cgpa: "profile_basics",
  no_english_test: "english_test",
  weak_english_band: "english_test",
  missing_documents: "transcripts",
  no_cv: "cv",
  no_sop: "sop",
  no_lor: "lor",
  no_research: "profile_basics",
  no_experience: "profile_basics",
  empty_shortlist: "shortlist",
};

/** Weaknesses that name one absent Evidence_Requirement rather than the pillar.
 *  `bucket` is the document bucket the evidence gates, which is how several
 *  candidates inside the Documents pillar are ranked against each other. */
const EVIDENCE_WEAKNESSES: readonly {
  key: WeaknessKey;
  pillar: PillarKey;
  bucket: DocBucket | null;
}[] = [
  { key: "no_english_test", pillar: "english", bucket: null },
  { key: "no_cv", pillar: "documents", bucket: "cv" },
  { key: "no_sop", pillar: "documents", bucket: "sop" },
  { key: "no_lor", pillar: "documents", bucket: "lor" },
  { key: "missing_documents", pillar: "documents", bucket: "transcripts" },
  { key: "empty_shortlist", pillar: "application_progress", bucket: null },
];

const compareKeys = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Points at stake descending → pillar weight descending → key ascending. A total
 *  order, so the output is deterministic. */
function orderNotes(notes: DerivedNote[], weighting: DegreeLevel): DerivedNote[] {
  return [...notes].sort(
    (a, b) =>
      b.pointsAtStake - a.pointsAtStake ||
      PILLAR_WEIGHTS[weighting][b.pillar] - PILLAR_WEIGHTS[weighting][a.pillar] ||
      compareKeys(a.key, b.key),
  );
}

const shareOf = (pillar: PillarScore) =>
  pillar.available === 0 ? 0 : pillar.earned / pillar.available;

export function deriveStrengths(breakdown: ScoreBreakdown): DerivedNote[] {
  const notes: DerivedNote[] = breakdown.pillars
    .filter((pillar) => shareOf(pillar) >= STRENGTH_THRESHOLD)
    .map((pillar) => ({
      key: STRENGTH_KEYS[pillar.pillar],
      pillar: pillar.pillar,
      pointsAtStake: pillar.available - pillar.earned,
      milestoneKey: null,
    }));
  return orderNotes(notes, breakdown.weighting).slice(0, 3);
}

/**
 * At most one Weakness per pillar, the evidence-named candidate winning over the
 * generic one. Without that cap the Documents pillar's four evidence requirements
 * would fill all three slots and crowd out a missing IELTS score.
 */
function weaknessKeyFor(
  pillar: PillarScore,
  inputs: RoadmapInputs,
  weighting: DegreeLevel,
): WeaknessKey | null {
  const buckets = DOC_BUCKET_WEIGHTS[weighting];
  const candidates = EVIDENCE_WEAKNESSES.filter(
    (candidate) =>
      candidate.pillar === pillar.pillar &&
      !evidenceSatisfied(inputs, WEAKNESS_RESOLVER[candidate.key]),
  ).sort(
    (a, b) =>
      (b.bucket ? buckets[b.bucket] : 0) - (a.bucket ? buckets[a.bucket] : 0) ||
      compareKeys(a.key, b.key),
  );
  if (candidates.length > 0) return candidates[0].key;
  return shareOf(pillar) <= WEAKNESS_THRESHOLD ? GENERIC_WEAKNESS[pillar.pillar] : null;
}

export function deriveWeaknesses(
  breakdown: ScoreBreakdown,
  inputs: RoadmapInputs,
): DerivedNote[] {
  // No diagnosis without a score. This is the rule that stops an empty profile
  // from producing three accusations.
  if (readinessOf(breakdown) === null) return [];

  const notes: DerivedNote[] = [];
  for (const pillar of breakdown.pillars) {
    if (!pillar.known) continue;
    const key = weaknessKeyFor(pillar, inputs, breakdown.weighting);
    if (!key) continue;
    notes.push({
      key,
      pillar: pillar.pillar,
      pointsAtStake: pillar.available - pillar.earned,
      milestoneKey: WEAKNESS_RESOLVER[key],
    });
  }
  return orderNotes(notes, breakdown.weighting).slice(0, 3);
}

// ── Evidence satisfaction and projection ────────────────────────────────────

/** The lowest CGPA band, so `profile_basics` projects the gain a student is
 *  guaranteed rather than an optimistic one. */
const MIN_PASSING_CGPA = { value: 2.5, scale: 4 } as const;

/** The band most programmes set as their floor, so `english_test` projects the
 *  gain from a passing score rather than from any score at all. */
const MIN_PASSING_ENGLISH_BAND = 6.5;

/** Resolves to the Generic_Path, so satisfying `target_choice` isolates the
 *  evidence field instead of also swapping the country document set under the
 *  Documents pillar. */
const MIN_PASSING_TARGET_COUNTRY = "generic";

function profileFieldPresent(inputs: RoadmapInputs, field: string): boolean {
  switch (field) {
    case "cgpa":
      return inputs.cgpa !== null;
    case "ielts_score":
      // A waiver satisfies the English requirement, and the scorer already pays
      // full credit for it, so it must not also read as missing evidence.
      return inputs.english.band !== null || isEnglishWaived(inputs);
    case "target_country":
      return typeof inputs.targetCountry === "string" && inputs.targetCountry.trim() !== "";
    default:
      return false;
  }
}

/** Whether the stored thing a milestone requires is in place. A milestone with no
 *  Evidence_Requirement — `apply`, `visa` — has nothing that could be absent. */
export function evidenceSatisfied(inputs: RoadmapInputs, key: MilestoneKey): boolean {
  const evidence = evidenceFor(key);
  if (!evidence) return true;
  switch (evidence.kind) {
    case "profile_field":
      return profileFieldPresent(inputs, evidence.field);
    case "docs_status":
      return evidence.docKey !== "lor_count" && inputs.docs[evidence.docKey] === "ready";
    case "docs_count":
      return (inputs.docs.lor_count ?? 0) >= evidence.atLeast;
    case "artefact":
      return evidence.artefact === "user_cv"
        ? inputs.hasCvRow || inputs.docs.cv === "ready"
        : inputs.bookmarkCount >= (evidence.atLeast ?? 1);
  }
}

function cloneInputs(inputs: RoadmapInputs): RoadmapInputs {
  return {
    ...inputs,
    cgpa: inputs.cgpa ? { ...inputs.cgpa } : null,
    english: { ...inputs.english },
    research: { ...inputs.research },
    experience: { ...inputs.experience },
    docs: { ...inputs.docs },
    preferredCountries: [...inputs.preferredCountries],
    intake: inputs.intake ? { ...inputs.intake } : null,
  };
}

/**
 * A copy of `inputs` with `key`'s Evidence_Requirement filled in at its minimum
 * passing value. Never mutates, and touches nothing but that requirement's own
 * fields — which is what makes "42% → 58%" the gain from doing the work rather
 * than from tapping a checkbox.
 */
export function satisfyEvidence(inputs: RoadmapInputs, key: MilestoneKey): RoadmapInputs {
  const copy = cloneInputs(inputs);
  const evidence = evidenceFor(key);
  // Nothing to prove, or already proven: an untouched copy.
  if (!evidence || evidenceSatisfied(inputs, key)) return copy;

  switch (evidence.kind) {
    case "profile_field":
      if (evidence.field === "cgpa") copy.cgpa = { ...MIN_PASSING_CGPA };
      else if (evidence.field === "ielts_score") {
        copy.english = { ...copy.english, band: MIN_PASSING_ENGLISH_BAND };
      } else if (evidence.field === "target_country") {
        copy.targetCountry = MIN_PASSING_TARGET_COUNTRY;
      }
      return copy;
    case "docs_status":
      if (evidence.docKey !== "lor_count") copy.docs = { ...copy.docs, [evidence.docKey]: "ready" };
      return copy;
    case "docs_count":
      copy.docs = {
        ...copy.docs,
        lor_count: Math.max(copy.docs.lor_count ?? 0, evidence.atLeast),
      };
      return copy;
    case "artefact":
      if (evidence.artefact === "user_cv") copy.hasCvRow = true;
      else copy.bookmarkCount = Math.max(copy.bookmarkCount, evidence.atLeast ?? 1);
      return copy;
  }
}

/** Readiness with that one milestone's evidence genuinely in place. `null`
 *  whenever the readiness gate is still shut, since the projection is the same
 *  rule applied to a different set of inputs. */
export function projectedReadiness(inputs: RoadmapInputs, key: MilestoneKey): number | null {
  return readinessOf(scoreProfile(satisfyEvidence(inputs, key)));
}

/**
 * Roadmap engine — the shared vocabulary.
 *
 * Types and constants only. Nothing in this file, or in any file that the engine
 * is built from, may import `@/utils/db`, call `fetch`, read `Date.now()` or
 * construct a `new Date()` with no argument. The single clock input the engine
 * accepts is a `now: number` parameter handed to `buildRoadmap`, and nothing in
 * scoring needs even that.
 *
 * These are the engine's *internal* types. The wire shapes live in
 * `packages/shared/src/types.ts`, are hand-written snake_case, and meet these
 * only inside `toWire()` in `GET /api/roadmap`. Keeping the two vocabularies
 * apart is what lets the engine be refactored without a client release.
 */

/** Bumped whenever scoring weights, catalog content or ordering rules change.
 *  It prefixes the fingerprint, so a bump invalidates every cached narration. */
export const ENGINE_VERSION = 1;

/** Readiness is withheld below this Confidence value. 40 means "at least four of
 *  the eight student-supplied inputs hold a known value". */
export const CONFIDENCE_FLOOR = 40;

export type Lang = "en" | "bn";
export type Bilingual = { en: string; bn: string };

export type DegreeLevel = "bachelor" | "master" | "phd";
export type Stage = "foundation" | "testing" | "documents" | "applications" | "visa";
export type MilestoneStatus = "todo" | "in_progress" | "done" | "skipped";
export type NodeState = "done" | "active" | "locked" | "skipped";
export type Feasibility = "on-track" | "tight" | "not-feasible";
export type CountrySource = "rules" | "generic";
export type IntakeTerm = "spring" | "summer" | "fall" | "winter";
export type NarrationStatus = "pending" | "ready" | "failed";
export type ProgressSource = "auto" | "manual" | "none";

/** The five country paths plus the generic fallback.
 *
 *  Declared here rather than in `country-rules.ts` because `scoring.ts` needs it
 *  for the `country_docs` bucket — the scorer has to know which document keys the
 *  resolved country requires — and `scoring.ts` must not depend on the catalog.
 *  `country-rules.ts` re-exports this name. */
export type CountryCode = "germany" | "canada" | "usa" | "uk" | "japan" | "generic";

export type PillarKey =
  | "academics"
  | "english"
  | "documents"
  | "research"
  | "experience"
  | "application_progress";

export type MilestoneKey =
  // country-independent catalog (12)
  | "profile_basics"
  | "target_choice"
  | "passport"
  | "english_test"
  | "transcripts"
  | "cv"
  | "sop"
  | "lor"
  | "shortlist"
  | "funding_plan"
  | "apply"
  | "visa"
  // country additions (2 per country)
  | "aps_germany"
  | "blocked_account_germany"
  | "proof_of_funds_canada"
  | "pal_canada"
  | "i20_usa"
  | "ds160_usa"
  | "cas_uk"
  | "ihs_uk"
  | "professor_contact_japan"
  | "coe_japan";

export type DocKey =
  | "passport"
  | "cv"
  | "sop"
  | "transcripts"
  | "funding_proof"
  | "lor"
  | "lor_count"
  | "aps"
  | "blocked_account"
  | "proof_of_funds"
  | "pal"
  | "i20"
  | "ds160"
  | "cas"
  | "ihs"
  | "professor_contact"
  | "coe";

export type DocStatus = "missing" | "in_progress" | "ready";

/** Which stored thing must exist before a milestone's completion moves a pillar.
 *  A milestone may carry none — `apply` and `visa` do not, because no table
 *  records a submitted application or an issued visa. */
export type EvidenceRequirement =
  | { kind: "profile_field"; field: string; label: Bilingual }
  | { kind: "docs_status"; docKey: DocKey; label: Bilingual }
  | { kind: "docs_count"; docKey: "lor_count"; atLeast: number; label: Bilingual }
  | { kind: "artefact"; artefact: "user_cv" | "bookmarks"; atLeast?: number; label: Bilingual };

/** Where a milestone's primary action sends the student. */
export type ActionTarget =
  | { kind: "cv" }
  | { kind: "discover"; filters: { country?: string; degree?: string } }
  | { kind: "mentor"; seedKey: string }
  | { kind: "guide"; slug: string }
  | { kind: "form"; section: "academics" | "target" | "english" | "docs" };

export type InputKey =
  | "degree"
  | "cgpa"
  | "english"
  | "docs"
  | "research"
  | "experience"
  | "target_country"
  | "intake";

/** Readiness stays `null` while either of these is unknown, whatever Confidence
 *  says. Together they decide the weighting column *and* the largest scoreable
 *  pillar, so no score computed without them is worth showing: a profile holding
 *  only the four answers the wizard collects clears the floor at Confidence 50
 *  and would otherwise report "6% ready". */
export const READINESS_GATE_INPUTS: readonly InputKey[] = ["degree", "cgpa"];

export type EnglishTestType = "ielts" | "toefl" | "duolingo" | "pte" | "moi" | "waiver";
export type EnglishTestStatus =
  | "not_started"
  | "preparing"
  | "booked"
  | "taken"
  | "scored"
  | "waived";

export type RoadmapInputs = {
  degree: DegreeLevel | null;
  cgpa: { value: number; scale: 4 | 5 } | null;
  english: {
    type: EnglishTestType | null;
    band: number | null; // IELTS-equivalent, 0-9
    status: EnglishTestStatus | null;
    testDate: string | null; // YYYY-MM-DD
  };
  research: { papers: number | null };
  experience: { workMonths: number | null; internshipMonths: number | null };
  docs: Partial<Record<Exclude<DocKey, "lor_count">, DocStatus>> & { lor_count?: number };
  bookmarkCount: number; // always known; 0 is a real 0
  hasCvRow: boolean; // always known
  targetCountry: string | null;
  preferredCountries: string[];
  intake: { term: IntakeTerm; year: number } | null;
  onboardedAt: string | null;
};

export type StrengthKey =
  | "strong_cgpa"
  | "strong_english"
  | "documents_ready"
  | "research_output"
  | "work_experience"
  | "active_shortlist";

export type WeaknessKey =
  | "low_cgpa"
  | "no_english_test"
  | "weak_english_band"
  | "missing_documents"
  | "no_sop"
  | "no_lor"
  | "no_cv"
  | "no_research"
  | "no_experience"
  | "empty_shortlist";

export type DerivedNote = {
  key: StrengthKey | WeaknessKey;
  pillar: PillarKey;
  pointsAtStake: number; // available − earned for that pillar
  milestoneKey: MilestoneKey | null; // set on every weakness
};

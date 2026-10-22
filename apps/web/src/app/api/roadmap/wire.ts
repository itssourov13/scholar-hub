import type {
  Bilingual,
  RoadmapAction,
  RoadmapMilestone,
  RoadmapNote,
  RoadmapPillar,
  RoadmapResponse,
} from "@scholarhub/shared";
import { sql, sqlQuery } from "@/utils/db";
import { NOTE_COPY } from "@/lib/roadmap/catalog";
import type { Milestone, ProgressRow, Roadmap } from "@/lib/roadmap/graph";
import { toRoadmapInputs } from "@/lib/roadmap/inputs";
import type { DerivedNote, MilestoneStatus, NarrationStatus } from "@/lib/roadmap/types";

/**
 * The I/O and vocabulary layer both roadmap routes share.
 *
 * Everything impure about the roadmap lives here: the four user-scoped reads, the
 * single upsert, and `toWire` — the one place the engine's camelCase types and
 * the hand-written snake_case wire shapes in `packages/shared` meet. The engine
 * stays free to refactor because nothing outside this file imports its types.
 *
 * The `@scholarhub/shared` import is **type-only**, resolved through a
 * `tsconfig.json` path rather than a package dependency: it makes a mismatch
 * between what a handler emits and what a client expects a compile error here
 * instead of a bug on a device. Importing a *value* from that package would need
 * `transpilePackages` in `next.config.ts`, because it ships TypeScript source.
 *
 * Not a route: the App Router only treats `route.ts` as an endpoint, so a
 * colocated module is the normal place for the pieces two sibling handlers share.
 */

type ProfileRow = Record<string, unknown>;

/** The stored narration, once task 4 writes it. Read defensively: this row is a
 *  cache, and a row written by an older engine version may hold anything. */
type StoredNarration = {
  milestones?: Record<string, Bilingual>;
  strengths?: Record<string, Bilingual>;
  weaknesses?: Record<string, Bilingual>;
  mentor?: Bilingual;
};

export type RoadmapRow = {
  previous_readiness: number | null;
  previous_engine_version: number | null;
  narration: StoredNarration | null;
  narration_status: string | null;
};

const NARRATION_STATUSES: readonly NarrationStatus[] = ["pending", "ready", "failed"];

function bilingualFrom(value: unknown): Bilingual | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const en = typeof record.en === "string" ? record.en.trim() : "";
  const bn = typeof record.bn === "string" ? record.bn.trim() : "";
  if (en === "" && bn === "") return null;
  return { en: en || bn, bn: bn || en };
}

function narrationFor(
  narration: StoredNarration | null,
  section: "milestones" | "strengths" | "weaknesses",
  key: string,
): Bilingual | null {
  const entry = narration?.[section]?.[key];
  return bilingualFrom(entry);
}

/** The mentor line when no narration has landed: the next action and what it is
 *  worth, built from values the engine already computed. `narrate.ts` replaces
 *  this with the model's phrasing and falls back to the same sentence. */
function derivedMentor(roadmap: Roadmap): Bilingual {
  const next = roadmap.nextAction;
  if (!next) {
    return {
      en: "Every step on your roadmap is done. Keep an eye on your deadlines.",
      bn: "আপনার রোডম্যাপের প্রতিটি ধাপ শেষ। এখন ডেডলাইনগুলোর দিকে খেয়াল রাখুন।",
    };
  }
  const milestone = roadmap.milestones.find((entry) => entry.key === next.key);
  const title = milestone?.title ?? { en: next.key, bn: next.key };

  if (roadmap.readiness !== null && next.projectedGain > 0) {
    const to = roadmap.readiness + next.projectedGain;
    return {
      en: `Start here: ${title.en}. Finishing it takes you from ${roadmap.readiness}% to ${to}%.`,
      bn: `এখান থেকে শুরু করুন: ${title.bn}। এটি শেষ করলে ${roadmap.readiness}% থেকে ${to}% হবে।`,
    };
  }
  if (next.evidenceLabel) {
    return {
      en: `Start here: ${title.en}. Add ${next.evidenceLabel.en} to move your score.`,
      bn: `এখান থেকে শুরু করুন: ${title.bn}। স্কোর বাড়াতে ${next.evidenceLabel.bn} যোগ করুন।`,
    };
  }
  return {
    en: `Start here: ${title.en}.`,
    bn: `এখান থেকে শুরু করুন: ${title.bn}।`,
  };
}

/**
 * A catalog slug names the guide a step *should* link to, not one that is known
 * to exist — none of the thirteen are written yet. A primary action that 404s is
 * worse than one that goes somewhere useful, so an unwritten slug falls back to
 * a published guide on the same topic, and to the mentor where there is no
 * honest stand-in.
 *
 * The first published candidate wins. Once a guide is written under the catalog
 * slug itself it matches directly and its row here is never read again, so this
 * table shrinks as content lands instead of needing upkeep.
 */
const GUIDE_FALLBACKS: Record<string, readonly string[]> = {
  "passport-for-students": ["essential-documents-for-studying-abroad-checklist"],
  "ielts-preparation": ["ielts-score-required-for-top-scholarships"],
  "transcript-attestation": [
    "scholarship-application-documents-guide",
    "essential-documents-for-studying-abroad-checklist",
  ],
  "proof-of-funds": ["scholarship-application-documents-guide"],
  "student-visa-bangladesh": ["bidyeshe-porar-journey-step-by-step-guide"],
  "aps-certificate-bangladesh": ["germany-higher-study-guide"],
  "blocked-account-germany": ["germany-higher-study-guide"],
  "i20-and-sevis": ["study-in-usa-complete-guide-scholarships"],
  "ds160-student-visa": ["study-in-usa-complete-guide-scholarships"],
  "cas-statement-uk": ["uk-scholarship-for-bangladeshi-students"],
  "uk-student-visa-costs": ["uk-scholarship-for-bangladeshi-students"],
  // Nothing published covers these closely enough to pretend otherwise: a
  // Canadian attestation letter and a Japanese CoE both go to the mentor.
  "provincial-attestation-letter": [],
  "certificate-of-eligibility-japan": [],
};

/** The published slug a step should link to, or `null` to send it to the mentor. */
function resolveGuide(slug: string, published: ReadonlySet<string>): string | null {
  if (published.has(slug)) return slug;
  for (const candidate of GUIDE_FALLBACKS[slug] ?? []) {
    if (published.has(candidate)) return candidate;
  }
  return null;
}

function actionToWire(
  milestone: Milestone,
  published: ReadonlySet<string> | null,
): RoadmapAction {
  const action = milestone.action;
  switch (action.kind) {
    case "mentor":
      // The one field whose name differs between the two vocabularies.
      return { kind: "mentor", seed_key: action.seedKey };
    case "discover":
      return { kind: "discover", filters: action.filters };
    case "guide": {
      // `null` means the caller did not say what is published. Keep the catalog's
      // intent rather than rerouting every guide step on missing information.
      if (!published) return { kind: "guide", slug: action.slug };
      const slug = resolveGuide(action.slug, published);
      return slug ? { kind: "guide", slug } : { kind: "mentor", seed_key: milestone.key };
    }
    case "form":
      return { kind: "form", section: action.section };
    case "cv":
      return { kind: "cv" };
  }
}

function noteToWire(
  note: DerivedNote,
  narration: StoredNarration | null,
  section: "strengths" | "weaknesses",
): RoadmapNote {
  return {
    key: note.key,
    pillar: note.pillar,
    points_at_stake: note.pointsAtStake,
    milestone_key: note.milestoneKey,
    // Narration when it landed; the engine's own sentence otherwise. Never empty:
    // the client keys its offline copy by `key`, but the wire field is not
    // optional and a blank chip is worse than a plain one.
    text: narrationFor(narration, section, note.key) ?? NOTE_COPY[note.key],
  };
}

function milestoneToWire(
  milestone: Milestone,
  narration: StoredNarration | null,
  published: ReadonlySet<string> | null,
): RoadmapMilestone {
  return {
    key: milestone.key,
    stage: milestone.stage,
    title: milestone.title,
    description: milestone.description,
    // `why` is the narrator's slot. Until it lands the catalog description does
    // the job, so a milestone card is never blank.
    why: narrationFor(narration, "milestones", milestone.key) ?? milestone.description,
    eta_days: milestone.etaDays,
    due_by: milestone.dueBy,
    priority: milestone.priority,
    status: milestone.status,
    state: milestone.state,
    source: milestone.source,
    progress: milestone.progress,
    target_count: milestone.targetCount,
    evidence_satisfied: milestone.evidenceSatisfied,
    evidence_label: milestone.evidenceLabel,
    projected_readiness: milestone.projectedReadiness,
    projected_gain: milestone.projectedGain,
    action: actionToWire(milestone, published),
  };
}

function pillarToWire(pillar: Roadmap["scoreBreakdown"]["pillars"][number]): RoadmapPillar {
  return {
    pillar: pillar.pillar,
    earned: pillar.earned,
    available: pillar.available,
    known: pillar.known,
    detail: pillar.detail,
  };
}

/**
 * Engine types → the wire shapes `packages/shared` declares.
 *
 * The wire types are fixed; this function adapts to them. Three fields have no
 * engine source and come from the stored row instead: `previous_readiness`,
 * `previous_engine_version` (both written by the upsert's `CASE` clauses, so the
 * engine cannot know them) and `narration_status`. `why`, note `text` and
 * `mentor` are the narrator's slots and fall back to engine copy.
 */
export function toWire(
  roadmap: Roadmap,
  row: RoadmapRow | null,
  options: { onboarded: boolean; publishedGuides?: ReadonlySet<string> },
): RoadmapResponse {
  const published = options.publishedGuides ?? null;
  const narration = row?.narration ?? null;
  const status = NARRATION_STATUSES.find((entry) => entry === row?.narration_status) ?? "pending";

  return {
    engine_version: roadmap.engineVersion,
    readiness: roadmap.readiness,
    previous_readiness: row?.previous_readiness ?? null,
    previous_engine_version: row?.previous_engine_version ?? null,
    confidence: roadmap.confidence,
    highest_weight_unknown: roadmap.scoreBreakdown.highestWeightUnknown,
    score_breakdown: {
      weighting: roadmap.scoreBreakdown.weighting,
      pillars: roadmap.scoreBreakdown.pillars.map(pillarToWire),
    },
    strengths: roadmap.strengths.map((note) => noteToWire(note, narration, "strengths")),
    weaknesses: roadmap.weaknesses.map((note) => noteToWire(note, narration, "weaknesses")),
    milestones: roadmap.milestones.map((milestone) =>
      milestoneToWire(milestone, narration, published),
    ),
    next_action: roadmap.nextAction
      ? {
          key: roadmap.nextAction.key,
          readiness: roadmap.nextAction.readiness,
          projected_readiness: roadmap.nextAction.projectedReadiness,
          projected_gain: roadmap.nextAction.projectedGain,
          evidence_label: roadmap.nextAction.evidenceLabel,
        }
      : null,
    feasibility: roadmap.feasibility,
    country_source: roadmap.countrySource,
    suggested_intake: roadmap.suggestedIntake,
    time_to_intake_days: roadmap.timeToIntakeDays,
    mentor: bilingualFrom(narration?.mentor) ?? derivedMentor(roadmap),
    narration_status: status,
    onboarded: options.onboarded,
  };
}

const MILESTONE_STATUSES: readonly MilestoneStatus[] = ["todo", "in_progress", "done", "skipped"];

/** A stored row, coerced at the boundary. `status` has no `CHECK` constraint —
 *  deliberately, so an `ENGINE_VERSION` bump can add values without a migration
 *  that locks a live table — which makes narrowing it the route's job. Timestamps
 *  arrive as `Date` from the driver and as strings from a fixture. */
function toProgressRow(raw: Record<string, unknown>): ProgressRow {
  const stamp = (value: unknown) =>
    value instanceof Date ? value.toISOString() : value == null ? null : String(value);
  const progress = raw.progress;
  return {
    milestone_key: String(raw.milestone_key),
    status: MILESTONE_STATUSES.find((entry) => entry === raw.status) ?? "todo",
    progress: progress == null || Number.isNaN(Number(progress)) ? null : Number(progress),
    manual_override: raw.manual_override === true,
    completed_at: stamp(raw.completed_at),
    celebrated_at: stamp(raw.celebrated_at),
  };
}

/** The four user-scoped reads the roadmap needs, in one round trip. */
export async function readRoadmapInputs(userId: string) {
  const [profileRows, bookmarkRows, cvRows, progressRows, guideRows] = await Promise.all([
    sql`SELECT * FROM profiles WHERE id = ${userId} LIMIT 1`,
    sql`SELECT COUNT(*)::int AS cnt FROM user_bookmarks WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*)::int AS cnt FROM user_cvs WHERE user_id = ${userId}`,
    sql`SELECT milestone_key, status, progress, manual_override, completed_at, celebrated_at
        FROM milestone_progress WHERE user_id = ${userId}`,
    // Not user-scoped, but read here so a step never links to a guide that is not
    // published. Slugs only — the column is indexed and the set is small.
    sql`SELECT slug FROM guides WHERE status = 'published'`,
  ]);

  const profile = (profileRows[0] ?? null) as ProfileRow | null;
  if (!profile) return null;

  return {
    profile,
    inputs: toRoadmapInputs(profile, {
      bookmarkCount: Number(bookmarkRows[0]?.cnt ?? 0),
      cvCount: Number(cvRows[0]?.cnt ?? 0),
    }),
    progress: progressRows.map((row) => toProgressRow(row as Record<string, unknown>)),
    publishedGuides: new Set(
      guideRows
        .map((row) => (row as { slug?: unknown }).slug)
        .filter((slug): slug is string => typeof slug === "string"),
    ) as ReadonlySet<string>,
  };
}

/**
 * One statement, so two concurrent opens converge on one row.
 *
 * `previous_readiness` and the engine version beside it move only when readiness
 * actually changed, which is what lets a drop be explained rather than silently
 * shown. `narration` and `narration_status` survive a recompute that produced the
 * same fingerprint and reset when it did not.
 */
export async function persistRoadmap(
  userId: string,
  roadmap: Roadmap,
): Promise<RoadmapRow | null> {
  const rows = await sqlQuery<RoadmapRow>(
    `INSERT INTO roadmaps (
       user_id, engine_version, profile_fingerprint, readiness, previous_readiness,
       previous_engine_version, confidence, feasibility, country_source,
       score_breakdown, strengths, weaknesses, milestones, next_action,
       narration_status, updated_at
     ) VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb,
               $11::jsonb, $12::jsonb, 'pending', NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       engine_version          = EXCLUDED.engine_version,
       profile_fingerprint     = EXCLUDED.profile_fingerprint,
       readiness               = EXCLUDED.readiness,
       previous_readiness      = CASE WHEN roadmaps.readiness IS DISTINCT FROM EXCLUDED.readiness
                                      THEN roadmaps.readiness ELSE roadmaps.previous_readiness END,
       previous_engine_version = CASE WHEN roadmaps.readiness IS DISTINCT FROM EXCLUDED.readiness
                                      THEN roadmaps.engine_version ELSE roadmaps.previous_engine_version END,
       confidence              = EXCLUDED.confidence,
       feasibility             = EXCLUDED.feasibility,
       country_source          = EXCLUDED.country_source,
       score_breakdown         = EXCLUDED.score_breakdown,
       strengths               = EXCLUDED.strengths,
       weaknesses              = EXCLUDED.weaknesses,
       milestones              = EXCLUDED.milestones,
       next_action             = EXCLUDED.next_action,
       narration_status        = CASE WHEN roadmaps.profile_fingerprint = EXCLUDED.profile_fingerprint
                                      THEN roadmaps.narration_status ELSE 'pending' END,
       narration               = CASE WHEN roadmaps.profile_fingerprint = EXCLUDED.profile_fingerprint
                                      THEN roadmaps.narration ELSE NULL END,
       updated_at              = NOW()
     RETURNING *`,
    [
      userId,
      roadmap.engineVersion,
      roadmap.fingerprint,
      roadmap.readiness,
      roadmap.confidence,
      roadmap.feasibility,
      roadmap.countrySource,
      JSON.stringify(roadmap.scoreBreakdown),
      JSON.stringify(roadmap.strengths),
      JSON.stringify(roadmap.weaknesses),
      JSON.stringify(roadmap.milestones),
      // SQL NULL rather than the JSON literal `null`, so "no next action" reads
      // the same in the column as it does in the response.
      roadmap.nextAction === null ? null : JSON.stringify(roadmap.nextAction),
    ],
  );
  return rows[0] ?? null;
}

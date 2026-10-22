/**
 * The path: filter, order, date, judge, project.
 *
 * `buildRoadmap` is the engine's one entry point and runs seven ordered steps —
 * resolve the country, assemble and filter the definitions, topologically sort
 * them, merge stored progress, plan due dates, assess feasibility, then score and
 * project. Each step is exported separately so a test can pin it without
 * building a whole roadmap.
 *
 * **Two rules the module boundary enforces, not a check somebody remembers.**
 * The scorer is called with `inputs` alone, so no stored status can move a pillar
 * — `progress` reaches this file and stops here. And the only clock input is the
 * `now` parameter: every date below is derived from it.
 *
 * **Every timestamp inside the planner is a Dhaka-day value.** `dhakaDayStart`
 * is the `DHAKA_OFFSET_MS` local-midnight expression lifted from
 * `apps/web/src/app/api/cron/push-digest/route.ts`, which shifts the epoch by six
 * hours so that a UTC-formatted day equals the Dhaka calendar day. Two
 * timestamps inside one Dhaka day therefore produce identical due dates, and
 * there is exactly one date convention in the codebase rather than two.
 *
 * Pure: no I/O, no clock.
 */

import { CATALOG, evidenceLabelFor, type MilestoneDef } from "./catalog";
import { resolveCountry, type CountryRule } from "./country-rules";
import { fingerprint } from "./fingerprint";
import {
  deriveStrengths,
  deriveWeaknesses,
  evidenceSatisfied,
  projectedReadiness,
  readinessOf,
  scoreProfile,
  type ScoreBreakdown,
} from "./scoring";
import {
  ENGINE_VERSION,
  type ActionTarget,
  type Bilingual,
  type CountrySource,
  type DerivedNote,
  type Feasibility,
  type IntakeTerm,
  type MilestoneKey,
  type MilestoneStatus,
  type NodeState,
  type PillarKey,
  type ProgressSource,
  type RoadmapInputs,
  type Stage,
} from "./types";

export type ProgressRow = {
  milestone_key: string;
  status: MilestoneStatus;
  progress: number | null;
  manual_override: boolean;
  completed_at: string | null;
  celebrated_at: string | null;
};

export type Milestone = {
  key: MilestoneKey;
  stage: Stage;
  title: Bilingual;
  description: Bilingual;
  etaDays: number;
  /** Only dependencies present in this path: a milestone the filter removed
   *  cannot be waited on. */
  dependsOn: MilestoneKey[];
  priority: number;
  status: MilestoneStatus;
  source: ProgressSource;
  state: NodeState;
  /** YYYY-MM-DD in Asia/Dhaka. */
  dueBy: string;
  progress: number | null;
  targetCount: number | null;
  pillar: PillarKey | null;
  evidenceSatisfied: boolean;
  /** Names what would release the points; `null` when nothing is missing. */
  evidenceLabel: Bilingual | null;
  projectedReadiness: number | null;
  /** 0 for a milestone self-reported `done` while its evidence is absent. */
  projectedGain: number;
  action: ActionTarget;
};

export type NextAction = {
  key: MilestoneKey;
  readiness: number | null;
  projectedReadiness: number | null;
  projectedGain: number;
  evidenceLabel: Bilingual | null;
};

export type Roadmap = {
  engineVersion: number;
  fingerprint: string;
  readiness: number | null;
  previousReadiness: number | null;
  previousEngineVersion: number | null;
  confidence: number;
  scoreBreakdown: ScoreBreakdown;
  strengths: DerivedNote[];
  weaknesses: DerivedNote[];
  milestones: Milestone[];
  nextAction: NextAction | null;
  feasibility: Feasibility;
  countrySource: CountrySource;
  suggestedIntake: { term: IntakeTerm; year: number } | null;
  timeToIntakeDays: number | null;
};

export const DAY_MS = 86_400_000;

/** Students are in Bangladesh (UTC+6); every "days left" should match their
 *  calendar. Same constant, same expression, as the push digest cron. */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** The overrun, in days, that separates `tight` from `not-feasible`. */
export const TIGHT_GRACE_DAYS = 30;

/**
 * The start of the Dhaka day containing `ms`, as a Dhaka-day value.
 *
 * Lifted from `api/cron/push-digest/route.ts`: shifting the epoch by the offset
 * and flooring to a day means the value's *UTC* calendar date is the Dhaka
 * calendar date, which is what makes `dhakaDateString` a slice rather than a
 * timezone library. Idempotent, so it is safe to apply twice.
 */
export function dhakaDayStart(ms: number): number {
  return Math.floor((ms + DHAKA_OFFSET_MS) / DAY_MS) * DAY_MS;
}

/** The Dhaka calendar date of a Dhaka-day value, as YYYY-MM-DD. */
export function dhakaDateString(dayValue: number): string {
  return new Date(dhakaDayStart(dayValue)).toISOString().slice(0, 10);
}

/** Whole Dhaka days between two instants — the same local-midnight-to-
 *  local-midnight count the push digest uses for "days left". */
export function dhakaDaysBetween(fromMs: number, toMs: number): number {
  return Math.round((dhakaDayStart(toMs) - dhakaDayStart(fromMs)) / DAY_MS);
}

/** The first Dhaka day of an intake, as a Dhaka-day value. The month comes from
 *  the country rule, because a German winter semester starts in October and a
 *  Canadian one in January. */
export function intakeStart(term: IntakeTerm, year: number, rule: CountryRule): number {
  return Date.UTC(year, rule.intakeStartMonth[term] - 1, 1);
}

/**
 * The next occurrence of `term` that starts after both today and the given
 * intake's own start.
 *
 * Both callers need that conjunction. A stored intake already in the past rolls
 * forward to the first one still ahead (Req 9.9); an intake still ahead that the
 * remaining work no longer fits rolls to the following year, because suggesting
 * the intake the student already missed the window for would be no suggestion at
 * all.
 */
export function nextIntakeAfter(
  term: IntakeTerm,
  year: number,
  now: number,
  rule: CountryRule,
): { term: IntakeTerm; year: number } {
  const floor = Math.max(dhakaDayStart(now), intakeStart(term, year, rule));
  let candidate = year;
  // Bounded by construction: each step adds a year, and one year is more than a
  // day, so the loop terminates on the first year whose start clears the floor.
  while (intakeStart(term, candidate, rule) <= floor) candidate += 1;
  return { term, year: candidate };
}

// ── Topological order ───────────────────────────────────────────────────────

export class CycleError extends Error {
  readonly keys: MilestoneKey[];

  constructor(keys: MilestoneKey[]) {
    super(`Milestone dependency cycle: ${keys.join(" → ")}`);
    this.name = "CycleError";
    this.keys = keys;
  }
}

/**
 * Kahn's algorithm with a total tie-break — priority ascending, then key
 * ascending — so the order is stable across runs and across insertion order.
 *
 * A dependency naming a milestone absent from `defs` is dropped rather than
 * treated as unsatisfiable: `appliesTo` filtering happens before this, and a
 * student whose English test was waived must not be left with an `apply` step
 * that can never unlock.
 */
export function topoSort(defs: readonly MilestoneDef[]): MilestoneKey[] {
  const present = new Set(defs.map((def) => def.key));
  const byKey = new Map(defs.map((def) => [def.key, def]));

  const pending = new Map<MilestoneKey, Set<MilestoneKey>>();
  const dependents = new Map<MilestoneKey, MilestoneKey[]>();
  for (const def of defs) {
    const deps = def.dependsOn.filter((dep) => present.has(dep) && dep !== def.key);
    pending.set(def.key, new Set(deps));
    for (const dep of deps) {
      dependents.set(dep, [...(dependents.get(dep) ?? []), def.key]);
    }
  }

  const rank = (key: MilestoneKey) => byKey.get(key)!.priority;
  const readyFirst = (a: MilestoneKey, b: MilestoneKey) =>
    rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0);

  const ready = [...pending.entries()]
    .filter(([, deps]) => deps.size === 0)
    .map(([key]) => key)
    .sort(readyFirst);

  const ordered: MilestoneKey[] = [];
  while (ready.length > 0) {
    const key = ready.shift()!;
    ordered.push(key);
    pending.delete(key);
    for (const dependent of dependents.get(key) ?? []) {
      const deps = pending.get(dependent);
      if (!deps) continue;
      deps.delete(key);
      if (deps.size === 0) {
        ready.push(dependent);
        ready.sort(readyFirst);
      }
    }
  }

  if (pending.size > 0) {
    // Whatever is left still has an unmet dependency inside the leftover set,
    // which is precisely a cycle. Sorted so the message is deterministic.
    throw new CycleError([...pending.keys()].sort());
  }
  return ordered;
}

// ── Due dates ───────────────────────────────────────────────────────────────

/**
 * Each milestone's due date is the intake start minus the summed durations of
 * everything downstream of it, so the last step lands on the intake and every
 * earlier one leaves room for the work that follows.
 *
 * Non-decreasing along the given order, because every duration is positive.
 */
export function planDueDates(
  ordered: readonly MilestoneDef[],
  intakeStartValue: number,
): Record<MilestoneKey, string> {
  const dates = {} as Record<MilestoneKey, string>;
  let downstreamDays = 0;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const def = ordered[i];
    dates[def.key] = dhakaDateString(intakeStartValue - downstreamDays * DAY_MS);
    downstreamDays += def.etaDays;
  }
  return dates;
}

// ── Feasibility ─────────────────────────────────────────────────────────────

/** A total band function over two day counts. The past-intake rule lives in
 *  `buildRoadmap`, because it needs the intake itself rather than a duration. */
export function assessFeasibility(remainingDays: number, timeToIntake: number): Feasibility {
  if (remainingDays <= timeToIntake) return "on-track";
  if (remainingDays <= timeToIntake + TIGHT_GRACE_DAYS) return "tight";
  return "not-feasible";
}

// ── buildRoadmap ────────────────────────────────────────────────────────────

/** A count a stored value already proves, for the milestones that track one. */
function autoProgressFor(def: MilestoneDef, inputs: RoadmapInputs): number | null {
  if (def.key === "lor") return inputs.docs.lor_count ?? null;
  return null;
}

/** The catalog declares `discover` without filters; the student's own country and
 *  degree fill them in here, which is the only place both are in scope. */
function resolveAction(
  action: ActionTarget,
  inputs: RoadmapInputs,
  rule: CountryRule,
  source: CountrySource,
): ActionTarget {
  if (action.kind !== "discover") return action;
  const filters: { country?: string; degree?: string } = {};
  // The canonical English label, not the student's spelling: "deutschland" is a
  // valid answer and matches nothing in the scholarship catalogue.
  if (source === "rules") filters.country = rule.label.en;
  if (inputs.degree) filters.degree = inputs.degree;
  return { kind: "discover", filters };
}

export function buildRoadmap(args: {
  inputs: RoadmapInputs;
  progress: readonly ProgressRow[];
  previous?: { readiness: number | null; engineVersion: number } | null;
  /** The only clock input the engine accepts. */
  now: number;
}): Roadmap {
  const { inputs, progress, now } = args;

  // 1. Resolve country.
  const { rule, source: countrySource } = resolveCountry(inputs.targetCountry);

  // 2. Assemble and filter, applying the rule's duration overrides.
  const defs = [...CATALOG, ...rule.extraMilestones]
    .filter((def) => def.appliesTo(inputs))
    .map((def) => ({ ...def, etaDays: rule.etaOverrides[def.key] ?? def.etaDays }));

  // 3. Topologically sort. A cycle is a programming error and is allowed to
  //    reach the route: a silently truncated path is worse than a 500.
  const orderedKeys = topoSort(defs);
  const byKey = new Map(defs.map((def) => [def.key, def]));
  const ordered = orderedKeys.map((key) => byKey.get(key)!);
  const present = new Set(orderedKeys);

  // 4. Merge stored progress: manual override wins, then auto-satisfaction, then
  //    whatever is stored, then `todo`. Stored keys outside this path are simply
  //    not returned; nothing deletes them.
  const stored = new Map<string, ProgressRow>(progress.map((row) => [row.milestone_key, row]));
  const merged = new Map<MilestoneKey, { status: MilestoneStatus; source: ProgressSource }>();
  for (const def of ordered) {
    const row = stored.get(def.key);
    if (row?.manual_override) merged.set(def.key, { status: row.status, source: "manual" });
    else if (def.isSatisfied(inputs)) merged.set(def.key, { status: "done", source: "auto" });
    else if (row) merged.set(def.key, { status: row.status, source: "none" });
    else merged.set(def.key, { status: "todo", source: "none" });
  }
  const statusOf = (key: MilestoneKey) => merged.get(key)!.status;

  // 5. Plan dates. With no intake stored the path is anchored on "if you start
  //    today", so every milestone still carries a real date and the client never
  //    has to render a blank.
  const totalEtaDays = ordered.reduce((sum, def) => sum + def.etaDays, 0);
  const anchor = inputs.intake
    ? intakeStart(inputs.intake.term, inputs.intake.year, rule)
    : dhakaDayStart(now) + totalEtaDays * DAY_MS;
  const dueDates = planDueDates(ordered, anchor);

  // 6. Assess feasibility. Work already done, or explicitly skipped, is not work
  //    remaining.
  const remainingDays = ordered
    .filter((def) => statusOf(def.key) !== "done" && statusOf(def.key) !== "skipped")
    .reduce((sum, def) => sum + def.etaDays, 0);
  const timeToIntakeDays = inputs.intake ? dhakaDaysBetween(now, anchor) : null;

  let feasibility: Feasibility;
  if (timeToIntakeDays === null) {
    // No intake chosen: there is no date to miss yet.
    feasibility = "on-track";
  } else if (timeToIntakeDays < 0) {
    feasibility = "not-feasible";
  } else {
    feasibility = assessFeasibility(remainingDays, timeToIntakeDays);
  }

  const suggestedIntake =
    inputs.intake && feasibility === "not-feasible"
      ? nextIntakeAfter(inputs.intake.term, inputs.intake.year, now, rule)
      : null;

  // 7. Score and project. The scorer sees `inputs` and nothing else.
  const breakdown = scoreProfile(inputs);
  const readiness = readinessOf(breakdown);

  const dependencySatisfied = (def: MilestoneDef) =>
    def.dependsOn
      .filter((dep) => present.has(dep))
      // A skipped dependency counts as settled: the student opted out of it, and
      // blocking everything behind it forever would deadlock the path.
      .every((dep) => statusOf(dep) === "done" || statusOf(dep) === "skipped");

  let activeAssigned = false;
  const milestones: Milestone[] = ordered.map((def) => {
    const { status, source } = merged.get(def.key)!;
    // A milestone with no Evidence_Requirement has nothing that could be absent,
    // which is different from having proven something.
    const hasEvidence = def.evidence !== null;
    const satisfied = !hasEvidence || evidenceSatisfied(inputs, def.key);
    const evidenceMissing = hasEvidence && !satisfied;
    const dependenciesMet = dependencySatisfied(def);

    let state: NodeState;
    if (status === "done") state = "done";
    else if (status === "skipped") state = "skipped";
    else if (dependenciesMet && !activeAssigned) {
      state = "active";
      activeAssigned = true;
    } else state = "locked";

    const projected = projectedReadiness(inputs, def.key);
    // A milestone somebody marked done while its evidence is absent dangles no
    // points: it reports the missing value instead (Req 6.7).
    const projectedGain =
      status === "done" && evidenceMissing
        ? 0
        : projected !== null && readiness !== null
          ? Math.max(0, projected - readiness)
          : 0;

    return {
      key: def.key,
      stage: def.stage,
      title: def.title,
      description: def.description,
      etaDays: def.etaDays,
      dependsOn: def.dependsOn.filter((dep) => present.has(dep)),
      priority: def.priority,
      status,
      source,
      state,
      dueBy: dueDates[def.key],
      progress: stored.get(def.key)?.progress ?? autoProgressFor(def, inputs),
      targetCount: def.targetCount ?? null,
      pillar: def.pillar,
      evidenceSatisfied: satisfied,
      evidenceLabel: evidenceMissing ? evidenceLabelFor(def.key) : null,
      projectedReadiness: projected,
      projectedGain,
      action: resolveAction(def.action, inputs, rule, countrySource),
    };
  });

  // The next action is drawn from every milestone whose dependencies are met,
  // not only the one rendered `active`: projected gain decides, then the earlier
  // due date, then the lower catalog priority.
  const candidates = milestones.filter(
    (milestone) =>
      milestone.status !== "done" &&
      milestone.status !== "skipped" &&
      dependencySatisfied(byKey.get(milestone.key)!),
  );
  const best = candidates.reduce<Milestone | null>((leader, milestone) => {
    if (!leader) return milestone;
    if (milestone.projectedGain !== leader.projectedGain) {
      return milestone.projectedGain > leader.projectedGain ? milestone : leader;
    }
    if (milestone.dueBy !== leader.dueBy) return milestone.dueBy < leader.dueBy ? milestone : leader;
    return milestone.priority < leader.priority ? milestone : leader;
  }, null);

  return {
    engineVersion: ENGINE_VERSION,
    fingerprint: fingerprint(inputs),
    readiness,
    previousReadiness: args.previous ? args.previous.readiness : null,
    previousEngineVersion: args.previous ? args.previous.engineVersion : null,
    confidence: breakdown.confidence,
    scoreBreakdown: breakdown,
    strengths: deriveStrengths(breakdown),
    weaknesses: deriveWeaknesses(breakdown, inputs),
    milestones,
    nextAction: best
      ? {
          key: best.key,
          readiness,
          projectedReadiness: best.projectedReadiness,
          projectedGain: best.projectedGain,
          evidenceLabel: best.evidenceLabel,
        }
      : null,
    feasibility,
    countrySource,
    suggestedIntake,
    timeToIntakeDays,
  };
}

/** The keys the current path contains, for the routes' "is this key mine?"
 *  check. */
export function pathKeys(roadmap: Roadmap): MilestoneKey[] {
  return roadmap.milestones.map((milestone) => milestone.key);
}

/** The keys whose dependencies are all settled — done or skipped. Read from the
 *  milestone list rather than from `state`, because `state` reports only the
 *  *first* eligible milestone as `active` and every other one as `locked`. */
function dependenciesMetIn(roadmap: Roadmap): Set<MilestoneKey> {
  const settled = new Set(
    roadmap.milestones
      .filter((milestone) => milestone.status === "done" || milestone.status === "skipped")
      .map((milestone) => milestone.key),
  );
  return new Set(
    roadmap.milestones
      .filter((milestone) => milestone.dependsOn.every((dep) => settled.has(dep)))
      .map((milestone) => milestone.key),
  );
}

/**
 * The milestones whose dependencies became satisfied between two roadmaps —
 * what the milestone route reports as `unlocked_keys`.
 *
 * The milestone that was just completed is not one of them: it is finished, not
 * newly available.
 */
export function unlockedBetween(before: Roadmap, after: Roadmap): MilestoneKey[] {
  const wasMet = dependenciesMetIn(before);
  const isMet = dependenciesMetIn(after);
  return after.milestones
    .filter(
      (milestone) =>
        isMet.has(milestone.key) &&
        !wasMet.has(milestone.key) &&
        milestone.status !== "done" &&
        milestone.status !== "skipped",
    )
    .map((milestone) => milestone.key);
}

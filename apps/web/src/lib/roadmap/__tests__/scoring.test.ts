import fc from "fast-check";
import { describe, expect, test } from "vitest";

import { MILESTONE_EVIDENCE } from "../evidence";
import { knownInputs, unknownInputs } from "../inputs";
import {
  DOC_BUCKET_ORDER,
  DOC_BUCKET_WEIGHTS,
  PILLAR_ORDER,
  PILLAR_WEIGHTS,
  WEAKNESS_RESOLVER,
  deriveStrengths,
  deriveWeaknesses,
  evidenceSatisfied,
  projectedReadiness,
  readinessOf,
  satisfyEvidence,
  scoreApplicationProgress,
  scoreProfile,
  type PillarScore,
} from "../scoring";
import { CONFIDENCE_FLOOR, type DegreeLevel, type MilestoneKey, type PillarKey } from "../types";
import { arbRoadmapInputs, diffPaths, withKnownInput } from "./arbitraries";

const DEGREES: readonly DegreeLevel[] = ["bachelor", "master", "phd"];
const MILESTONE_KEYS = Object.keys(MILESTONE_EVIDENCE) as MilestoneKey[];

const shareOf = (pillar: PillarScore) => pillar.earned / pillar.available;

// ── The weight tables ────────────────────────────────────────────────────────
//
// Asserted rather than read, because "every column sums to 100" is what makes the
// available points independent of the degree — and a column that drifts to 99
// silently caps every student in that bracket at 99% ready.

describe("the weight tables", () => {
  test("every pillar column sums to 100", () => {
    for (const degree of DEGREES) {
      const column = PILLAR_WEIGHTS[degree];
      const total = PILLAR_ORDER.reduce((sum, pillar) => sum + column[pillar], 0);
      expect(total, `${degree} column`).toBe(100);
      // …and holds exactly the six pillars, all positive: a zero-weight pillar
      // would make its share undefined.
      expect(Object.keys(column).sort()).toEqual([...PILLAR_ORDER].sort());
      for (const pillar of PILLAR_ORDER) expect(column[pillar]).toBeGreaterThan(0);
    }
  });

  test("every document bucket column sums to that column's Documents weight", () => {
    for (const degree of DEGREES) {
      const buckets = DOC_BUCKET_WEIGHTS[degree];
      const total = DOC_BUCKET_ORDER.reduce((sum, bucket) => sum + buckets[bucket], 0);
      expect(total, `${degree} buckets`).toBe(PILLAR_WEIGHTS[degree].documents);
      expect(Object.keys(buckets).sort()).toEqual([...DOC_BUCKET_ORDER].sort());
    }
  });

  test("the master column is the documented baseline", () => {
    expect(PILLAR_WEIGHTS.master).toEqual({
      academics: 20,
      english: 20,
      documents: 25,
      research: 15,
      experience: 10,
      application_progress: 10,
    });
  });
});

// ── Property 5 ───────────────────────────────────────────────────────────────

// Feature: roadmap, Property 5: For any RoadmapInputs and for any fixed
// timestamp, two calls return deep-equal readiness, score breakdown, strength list
// and weakness list, in the same order.
test("scoring is deterministic", () => {
  fc.assert(
    fc.property(arbRoadmapInputs(), (inputs) => {
      // No timestamp appears in the signature at all, which is the strongest form
      // of "for any fixed timestamp": there is nothing for a clock to change.
      const first = scoreProfile(inputs);
      const second = scoreProfile(inputs);

      expect(second).toEqual(first);
      expect(readinessOf(second)).toEqual(readinessOf(first));
      expect(deriveStrengths(second)).toEqual(deriveStrengths(first));
      expect(deriveWeaknesses(second, inputs)).toEqual(deriveWeaknesses(first, inputs));
      // Order, not just membership.
      expect(second.pillars.map((pillar) => pillar.pillar)).toEqual([...PILLAR_ORDER]);
    }),
    { numRuns: 100 },
  );
});

// ── Property 7 ───────────────────────────────────────────────────────────────

// Feature: roadmap, Property 7: For any RoadmapInputs, the breakdown holds exactly
// six pillars, their available points sum to 100, their earned points sum to the
// reported earned total, no pillar's earned exceeds its available, and the applied
// weighting equals the input degree or master when the degree is unknown.
test("the breakdown adds up", () => {
  fc.assert(
    fc.property(arbRoadmapInputs(), (inputs) => {
      const breakdown = scoreProfile(inputs);

      expect(breakdown.pillars).toHaveLength(6);
      expect(breakdown.pillars.map((pillar) => pillar.pillar)).toEqual([...PILLAR_ORDER]);

      const available = breakdown.pillars.reduce((sum, pillar) => sum + pillar.available, 0);
      expect(available).toBe(100);

      const earned = breakdown.pillars.reduce((sum, pillar) => sum + pillar.earned, 0);
      expect(breakdown.earned).toBe(earned);
      expect(breakdown.earned).toBeGreaterThanOrEqual(0);
      expect(breakdown.earned).toBeLessThanOrEqual(100);

      for (const pillar of breakdown.pillars) {
        expect(Number.isInteger(pillar.earned)).toBe(true);
        expect(pillar.earned).toBeGreaterThanOrEqual(0);
        expect(pillar.earned).toBeLessThanOrEqual(pillar.available);
        expect(pillar.available).toBe(PILLAR_WEIGHTS[breakdown.weighting][pillar.pillar]);
      }

      expect(breakdown.weighting).toBe(inputs.degree ?? "master");
    }),
    { numRuns: 100 },
  );
});

// ── Property 10 ──────────────────────────────────────────────────────────────

/** The published band table, restated so the property checks the design rather
 *  than the implementation's opinion of it. */
function publishedBookmarkPoints(count: number): number {
  if (count >= 10) return 10;
  if (count >= 6) return 8;
  if (count >= 3) return 6;
  if (count >= 1) return 3;
  return 0;
}

// Feature: roadmap, Property 10: For any two bookmark counts a ≤ b, the points
// awarded for a are at most the points awarded for b, and for any count the points
// equal the published band table.
test("application progress is a monotonic function of bookmark count", () => {
  fc.assert(
    fc.property(
      arbRoadmapInputs(),
      fc.integer({ min: 0, max: 40 }),
      fc.integer({ min: 0, max: 40 }),
      fc.constantFrom(...DEGREES),
      (inputs, first, second, weighting) => {
        const [low, high] = first <= second ? [first, second] : [second, first];
        const pointsFor = (count: number) =>
          scoreApplicationProgress({ ...inputs, bookmarkCount: count }, weighting).earned;

        expect(pointsFor(low)).toBeLessThanOrEqual(pointsFor(high));
        // Every column carries 10 available points, so the table is absolute.
        expect(pointsFor(low)).toBe(publishedBookmarkPoints(low));
        expect(pointsFor(high)).toBe(publishedBookmarkPoints(high));
        // 0 bookmarks is a fact, never a gap.
        expect(scoreApplicationProgress({ ...inputs, bookmarkCount: 0 }, weighting).known).toBe(
          true,
        );
      },
    ),
    { numRuns: 100 },
  );
});

// ── Property 11 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 11: For any RoadmapInputs, readiness is an integer in
// 0-100 if and only if confidence is at least 40 and neither degree nor cgpa is in
// the unknown-input set, and readiness === null in every other case — including
// every profile that clears the floor on the four wizard inputs alone; and for any
// unknown InputKey given a value, confidence does not decrease.
test("readiness is an integer exactly when the floor is cleared and the academic inputs are known", () => {
  fc.assert(
    fc.property(arbRoadmapInputs(), (inputs) => {
      const breakdown = scoreProfile(inputs);
      const readiness = readinessOf(breakdown);

      const gateOpen =
        breakdown.confidence >= CONFIDENCE_FLOOR &&
        !breakdown.unknownInputs.includes("degree") &&
        !breakdown.unknownInputs.includes("cgpa");

      if (gateOpen) {
        expect(typeof readiness).toBe("number");
        expect(Number.isInteger(readiness)).toBe(true);
        expect(readiness as number).toBeGreaterThanOrEqual(0);
        expect(readiness as number).toBeLessThanOrEqual(100);
      } else {
        expect(readiness).toBeNull();
      }

      // Confidence never falls when one more input becomes known.
      for (const key of breakdown.unknownInputs) {
        const answered = scoreProfile(withKnownInput(inputs, key));
        expect(answered.confidence).toBeGreaterThanOrEqual(breakdown.confidence);
        expect(knownInputs(withKnownInput(inputs, key)).length).toBeGreaterThan(
          knownInputs(inputs).length - 1,
        );
      }
    }),
    { numRuns: 100 },
  );
});

test("a profile clearing the floor on the four wizard inputs alone still reports null", () => {
  fc.assert(
    fc.property(arbRoadmapInputs(), (inputs) => {
      // Exactly the four answers the wizard collects, and nothing else.
      const wizardOnly = {
        ...inputs,
        degree: null,
        cgpa: null,
        research: { papers: null },
        experience: { workMonths: null, internshipMonths: null },
        english: { ...inputs.english, status: "preparing" as const },
        docs: { ...inputs.docs, passport: "ready" as const },
        targetCountry: "Germany",
        intake: { term: "fall" as const, year: 2026 },
      };
      const breakdown = scoreProfile(wizardOnly);

      expect(unknownInputs(wizardOnly)).toEqual(["degree", "cgpa", "research", "experience"]);
      expect(breakdown.confidence).toBe(50);
      expect(breakdown.confidence).toBeGreaterThanOrEqual(CONFIDENCE_FLOOR);
      expect(readinessOf(breakdown)).toBeNull();
    }),
    { numRuns: 100 },
  );
});

// ── Property 13 ──────────────────────────────────────────────────────────────

/** The fields each milestone's Evidence_Requirement is allowed to touch. Derived
 *  from the evidence table, so a new milestone cannot quietly widen it. */
function allowedPathsFor(key: MilestoneKey): string[] {
  const evidence = MILESTONE_EVIDENCE[key];
  if (!evidence) return [];
  switch (evidence.kind) {
    case "profile_field":
      if (evidence.field === "cgpa") return ["cgpa", "cgpa.value", "cgpa.scale"];
      if (evidence.field === "ielts_score") return ["english.band"];
      return ["targetCountry"];
    case "docs_status":
      return [`docs.${evidence.docKey}`];
    case "docs_count":
      return ["docs.lor_count"];
    case "artefact":
      return evidence.artefact === "user_cv" ? ["hasCvRow"] : ["bookmarkCount"];
  }
}

// Feature: roadmap, Property 13: For any RoadmapInputs and for any milestone key,
// projectedReadiness(inputs, key) equals the readiness of
// scoreProfile(satisfyEvidence(inputs, key)), satisfyEvidence returns a value
// deep-unequal to its argument only in that milestone's evidence fields, and the
// argument itself is unmutated.
test("projection means the evidence is in place", () => {
  fc.assert(
    fc.property(arbRoadmapInputs(), fc.constantFrom(...MILESTONE_KEYS), (inputs, key) => {
      const before = structuredClone(inputs);

      const satisfied = satisfyEvidence(inputs, key);
      const projected = projectedReadiness(inputs, key);

      // The projection is the score with the evidence in place, nothing else.
      expect(projected).toEqual(readinessOf(scoreProfile(satisfied)));

      // The argument is untouched.
      expect(inputs).toEqual(before);
      expect(satisfied).not.toBe(inputs);
      expect(satisfied.docs).not.toBe(inputs.docs);

      // Only that milestone's evidence fields moved.
      const changed = diffPaths(inputs, satisfied);
      const allowed = allowedPathsFor(key);
      for (const path of changed) expect(allowed).toContain(path);

      // …and afterwards the evidence really is satisfied.
      expect(evidenceSatisfied(satisfied, key)).toBe(true);
      // Already-satisfied evidence is a no-op, so the projection cannot inflate a
      // gain for work that is already done.
      if (evidenceSatisfied(inputs, key)) {
        expect(changed).toEqual([]);
        expect(projected).toEqual(readinessOf(scoreProfile(inputs)));
      }
    }),
    { numRuns: 100 },
  );
});

// ── Property 17 ──────────────────────────────────────────────────────────────

/** Mirrors `EVIDENCE_WEAKNESSES` in scoring.ts. Restated on purpose: a property
 *  that asks the implementation what the rule is proves nothing. */
const EVIDENCE_WEAKNESS_PILLARS: Partial<Record<keyof typeof WEAKNESS_RESOLVER, PillarKey>> = {
  no_english_test: "english",
  no_cv: "documents",
  no_sop: "documents",
  no_lor: "documents",
  missing_documents: "documents",
  empty_shortlist: "application_progress",
};

// Feature: roadmap, Property 17: For any RoadmapInputs: every pillar earning at
// least 70 percent of its available points appears in the strength set; when
// readiness is not null, every pillar that has known: true and either earns at most
// 30 percent or has an absent Evidence_Requirement contributes exactly one
// weakness; no pillar contributes more than one weakness; no weakness references a
// pillar with known: false; when readiness is null the weakness list is empty; both
// lists hold at most three entries, are sorted by points at stake descending then
// pillar weight descending then key ascending, and every weakness carries a
// resolving milestone key present in the returned path.
test("strengths and weaknesses follow the thresholds, and unknown never accuses", () => {
  fc.assert(
    fc.property(arbRoadmapInputs(), (inputs) => {
      const breakdown = scoreProfile(inputs);
      const readiness = readinessOf(breakdown);
      const strengths = deriveStrengths(breakdown);
      const weaknesses = deriveWeaknesses(breakdown, inputs);
      const weights = PILLAR_WEIGHTS[breakdown.weighting];

      const sortedByRule = (notes: typeof strengths) => {
        for (let i = 1; i < notes.length; i += 1) {
          const previous = notes[i - 1];
          const current = notes[i];
          if (previous.pointsAtStake !== current.pointsAtStake) {
            expect(previous.pointsAtStake).toBeGreaterThan(current.pointsAtStake);
            continue;
          }
          if (weights[previous.pillar] !== weights[current.pillar]) {
            expect(weights[previous.pillar]).toBeGreaterThan(weights[current.pillar]);
            continue;
          }
          expect(previous.key < current.key).toBe(true);
        }
      };

      // ── strengths ──
      const qualifyingStrengths = breakdown.pillars.filter(
        (pillar) => shareOf(pillar) >= 0.7,
      );
      expect(strengths).toHaveLength(Math.min(qualifyingStrengths.length, 3));
      const strengthPillars = strengths.map((note) => note.pillar);
      for (const pillar of strengthPillars) {
        expect(qualifyingStrengths.map((entry) => entry.pillar)).toContain(pillar);
      }
      if (qualifyingStrengths.length <= 3) {
        expect([...strengthPillars].sort()).toEqual(
          qualifyingStrengths.map((entry) => entry.pillar).sort(),
        );
      }
      expect(new Set(strengthPillars).size).toBe(strengthPillars.length);
      sortedByRule(strengths);

      // ── weaknesses ──
      if (readiness === null) {
        expect(weaknesses).toEqual([]);
        return;
      }

      const qualifyingWeaknesses = breakdown.pillars.filter((pillar) => {
        if (!pillar.known) return false;
        if (shareOf(pillar) <= 0.3) return true;
        return Object.entries(EVIDENCE_WEAKNESS_PILLARS).some(
          ([key, evidencePillar]) =>
            evidencePillar === pillar.pillar &&
            !evidenceSatisfied(inputs, WEAKNESS_RESOLVER[key as keyof typeof WEAKNESS_RESOLVER]),
        );
      });

      expect(weaknesses).toHaveLength(Math.min(qualifyingWeaknesses.length, 3));
      const weaknessPillars = weaknesses.map((note) => note.pillar);
      // At most one per pillar, and never a pillar the engine does not know.
      expect(new Set(weaknessPillars).size).toBe(weaknessPillars.length);
      for (const note of weaknesses) {
        const pillar = breakdown.pillars.find((entry) => entry.pillar === note.pillar);
        expect(pillar?.known).toBe(true);
        expect(qualifyingWeaknesses.map((entry) => entry.pillar)).toContain(note.pillar);
        expect(note.pointsAtStake).toBe((pillar?.available ?? 0) - (pillar?.earned ?? 0));
        // Every weakness names the milestone that resolves it, and that milestone
        // is a real catalog key. (Path membership is task 3's assertion.)
        expect(note.milestoneKey).not.toBeNull();
        expect(MILESTONE_KEYS).toContain(note.milestoneKey as MilestoneKey);
        expect(WEAKNESS_RESOLVER[note.key as keyof typeof WEAKNESS_RESOLVER]).toBe(
          note.milestoneKey,
        );
      }
      if (qualifyingWeaknesses.length <= 3) {
        expect([...weaknessPillars].sort()).toEqual(
          qualifyingWeaknesses.map((entry) => entry.pillar).sort(),
        );
      }
      sortedByRule(weaknesses);
    }),
    { numRuns: 100 },
  );
});

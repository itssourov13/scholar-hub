import { describe, expect, test } from "vitest";

import { knownInputs, unknownInputs } from "../inputs";
import {
  WEAKNESS_RESOLVER,
  deriveStrengths,
  deriveWeaknesses,
  readinessOf,
  scoreProfile,
} from "../scoring";
import { PERSONAS, personaByName } from "./personas";

/**
 * The six persona fixtures.
 *
 * Every expected number in `personas.ts` was computed by hand from the design's
 * weight, band and bucket tables. These assertions are therefore a check on the
 * implementation, not a snapshot of it: if one fails, either the arithmetic in the
 * design is wrong or the code is, and both are worth stopping for.
 */

for (const persona of PERSONAS) {
  describe(`persona: ${persona.name}`, () => {
    const breakdown = scoreProfile(persona.inputs);
    const readiness = readinessOf(breakdown);
    const expected = persona.expected;

    test("applies the expected weighting column", () => {
      expect(breakdown.weighting).toBe(expected.weighting);
    });

    test("knows exactly the expected inputs, and reports the matching confidence", () => {
      expect(knownInputs(persona.inputs)).toEqual([...expected.knownInputs]);
      expect(breakdown.confidence).toBe(expected.confidence);
      expect(breakdown.unknownInputs).toEqual(unknownInputs(persona.inputs));
      expect(breakdown.highestWeightUnknown).toBe(expected.highestWeightUnknown);
    });

    test("earns the expected points in every pillar, with the expected known flag", () => {
      const actual = Object.fromEntries(
        breakdown.pillars.map((pillar) => [
          pillar.pillar,
          { earned: pillar.earned, available: pillar.available, known: pillar.known },
        ]),
      );
      expect(actual).toEqual(expected.pillars);
      expect(breakdown.earned).toBe(expected.earned);
    });

    test("reports the expected readiness", () => {
      expect(readiness).toBe(expected.readiness);
    });

    test("derives the expected strengths, in order", () => {
      expect(deriveStrengths(breakdown).map((note) => note.key)).toEqual([...expected.strengths]);
    });

    test("derives the expected weaknesses, in order, each with a resolving milestone", () => {
      const weaknesses = deriveWeaknesses(breakdown, persona.inputs);
      expect(
        weaknesses.map((note) => ({ key: note.key, pointsAtStake: note.pointsAtStake })),
      ).toEqual([...expected.weaknesses]);
      for (const note of weaknesses) {
        expect(note.milestoneKey).toBe(WEAKNESS_RESOLVER[note.key as keyof typeof WEAKNESS_RESOLVER]);
      }
    });

    test("every pillar detail is non-empty in both languages", () => {
      for (const pillar of breakdown.pillars) {
        expect(pillar.detail.en.trim()).not.toBe("");
        expect(pillar.detail.bn.trim()).not.toBe("");
      }
    });
  });
}

// ── The gate's reason for existing ───────────────────────────────────────────

describe("the readiness gate, stated as its own regression", () => {
  test("a wizard-only profile reports null rather than the 6 its pillars sum to", () => {
    const persona = personaByName("Wizard just finished");
    const breakdown = scoreProfile(persona.inputs);

    // The floor is cleared…
    expect(breakdown.confidence).toBe(50);
    expect(breakdown.confidence).toBeGreaterThanOrEqual(40);
    // …the pillars do sum to a number…
    expect(breakdown.earned).toBe(6);
    // …and the gate still withholds it, because both academic inputs are unknown.
    expect(breakdown.unknownInputs).toContain("degree");
    expect(breakdown.unknownInputs).toContain("cgpa");
    expect(readinessOf(breakdown)).toBeNull();
    // No diagnosis without a score.
    expect(deriveWeaknesses(breakdown, persona.inputs)).toEqual([]);
    expect(deriveStrengths(breakdown)).toEqual([]);
  });

  test("adding the CGPA alone does not open the gate; adding the degree too does", () => {
    const persona = personaByName("Wizard just finished");
    const withCgpa = { ...persona.inputs, cgpa: { value: 3.4, scale: 4 as const } };
    expect(readinessOf(scoreProfile(withCgpa))).toBeNull();

    const withBoth = { ...withCgpa, degree: "master" as const };
    const opened = scoreProfile(withBoth);
    expect(opened.confidence).toBe(75);
    expect(readinessOf(opened)).toBe(20);
  });
});

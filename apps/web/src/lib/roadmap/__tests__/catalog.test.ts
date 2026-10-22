import fc from "fast-check";
import { describe, expect, test } from "vitest";

import { CATALOG, CATALOG_KEYS, MENTOR_SEEDS, NOTE_COPY, milestoneByKey } from "../catalog";
import type { MilestoneDef } from "../catalog";
import {
  ALL_EXTRA_MILESTONES,
  COUNTRY_RULES,
  GENERIC_RULE,
  resolveCountry,
} from "../country-rules";
import { COUNTRY_ALIASES, MILESTONE_EVIDENCE } from "../evidence";
import { buildRoadmap } from "../graph";
import { WEAKNESS_RESOLVER } from "../scoring";
import type { RoadmapInputs } from "../types";
import { arbNow, arbRoadmapInputs, arbUnmatchedCountry } from "./arbitraries";
import { emptyInputs } from "./personas";

const NOW = Date.UTC(2026, 0, 15, 3, 0, 0);

const keysOf = (inputs: RoadmapInputs, now = NOW) =>
  buildRoadmap({ inputs, progress: [], now }).milestones.map((milestone) => milestone.key);

const FORM_SECTIONS = ["academics", "target", "english", "docs"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── Property 18 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 18: For any entry in the milestone catalog or in any
// country rule: the key is unique, English and Bangla title and description are
// non-empty, the estimated duration is positive, every dependency names an entry
// present in the same assembled set, the priority index is unique, and the action
// target is one of the five declared kinds with a resolvable slug or seed key. The
// country-independent catalog holds between 10 and 12 entries.
test("the catalog is well formed", () => {
  // The assembled sets a student can actually receive: the catalog alone, and the
  // catalog plus one country's additions.
  const assembled: { name: string; defs: readonly MilestoneDef[] }[] = [
    { name: "generic", defs: CATALOG },
    ...COUNTRY_RULES.map((rule) => ({
      name: rule.code,
      defs: [...CATALOG, ...rule.extraMilestones],
    })),
  ];

  fc.assert(
    fc.property(fc.constantFrom(...assembled), ({ name, defs }) => {
      const keys = defs.map((def) => def.key);
      expect(new Set(keys).size, `${name}: duplicate key`).toBe(keys.length);

      const priorities = defs.map((def) => def.priority);
      expect(new Set(priorities).size, `${name}: duplicate priority`).toBe(priorities.length);

      for (const def of defs) {
        expect(def.title.en.trim(), `${def.key} title.en`).not.toBe("");
        expect(def.title.bn.trim(), `${def.key} title.bn`).not.toBe("");
        expect(def.description.en.trim(), `${def.key} description.en`).not.toBe("");
        expect(def.description.bn.trim(), `${def.key} description.bn`).not.toBe("");
        expect(def.etaDays, `${def.key} etaDays`).toBeGreaterThan(0);
        expect(Number.isInteger(def.etaDays), `${def.key} etaDays integer`).toBe(true);

        for (const dep of def.dependsOn) {
          expect(keys, `${def.key} depends on ${dep}`).toContain(dep);
          expect(dep, `${def.key} depends on itself`).not.toBe(def.key);
        }

        // Evidence is read from the one table the scorer reads, never restated.
        expect(def.evidence, `${def.key} evidence`).toBe(MILESTONE_EVIDENCE[def.key]);

        switch (def.action.kind) {
          case "cv":
            break;
          case "discover":
            expect(typeof def.action.filters, `${def.key} discover filters`).toBe("object");
            break;
          case "mentor":
            expect(
              Object.keys(MENTOR_SEEDS),
              `${def.key} mentor seed ${def.action.seedKey}`,
            ).toContain(def.action.seedKey);
            break;
          case "guide":
            expect(def.action.slug, `${def.key} guide slug`).toMatch(SLUG);
            break;
          case "form":
            expect(FORM_SECTIONS, `${def.key} form section`).toContain(def.action.section);
            break;
          default:
            throw new Error(`${def.key}: unknown action kind`);
        }
      }
    }),
    { numRuns: 100 },
  );

  expect(CATALOG.length).toBeGreaterThanOrEqual(10);
  expect(CATALOG.length).toBeLessThanOrEqual(12);
  // Priorities are unique across the catalog *and* every rule at once, so no
  // assembled path can ever tie.
  const everyPriority = [...CATALOG, ...ALL_EXTRA_MILESTONES].map((def) => def.priority);
  expect(new Set(everyPriority).size).toBe(everyPriority.length);
});

// ── Property 12 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 12: For any target_country string absent from every
// alias list, including null, arbitrary unicode and comma-joined lists, the
// returned path equals the generic path, country_source is generic, and every
// returned milestone carries non-empty English and Bangla copy.
test("an unrecognised country yields the generic path, fully translated", () => {
  const everyAlias = new Set(Object.values(COUNTRY_ALIASES).flat());

  fc.assert(
    fc.property(arbRoadmapInputs(), arbUnmatchedCountry, arbNow(), (base, country, now) => {
      const needle = typeof country === "string" ? country.trim().toLowerCase() : "";
      // Filter rather than reject: a generated string could legitimately be an
      // alias, and that case is Property 19's.
      fc.pre(!everyAlias.has(needle));

      const inputs = { ...base, targetCountry: country };
      const roadmap = buildRoadmap({ inputs, progress: [], now });
      const generic = buildRoadmap({ inputs: { ...base, targetCountry: null }, progress: [], now });

      expect(roadmap.countrySource).toBe("generic");
      expect(roadmap.milestones.map((m) => m.key)).toEqual(generic.milestones.map((m) => m.key));
      // No country additions: the generic path is the catalog, minus whatever
      // appliesTo removed.
      for (const key of roadmap.milestones.map((m) => m.key)) {
        expect(CATALOG_KEYS).toContain(key);
      }
      for (const milestone of roadmap.milestones) {
        expect(milestone.title.en.trim()).not.toBe("");
        expect(milestone.title.bn.trim()).not.toBe("");
        expect(milestone.description.en.trim()).not.toBe("");
        expect(milestone.description.bn.trim()).not.toBe("");
      }
    }),
    { numRuns: 100 },
  );
});

// ── Property 19 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 19: For any RoadmapInputs and for any of the five
// country rules, the returned key list contains every extra key that rule
// declares and contains no key whose appliesTo predicate rejected the inputs.
test("a matched country adds its steps and drops what does not apply", () => {
  fc.assert(
    fc.property(
      arbRoadmapInputs(),
      fc.constantFrom(...COUNTRY_RULES),
      fc.integer({ min: 0, max: 8 }),
      arbNow(),
      (base, rule, aliasIndex, now) => {
        // Any spelling of the country, not just the canonical one.
        const alias = rule.aliases[aliasIndex % rule.aliases.length];
        const inputs = { ...base, targetCountry: alias };
        const roadmap = buildRoadmap({ inputs, progress: [], now });
        const keys = roadmap.milestones.map((milestone) => milestone.key);

        expect(roadmap.countrySource).toBe("rules");
        for (const extra of rule.extraMilestones) expect(keys).toContain(extra.key);

        for (const def of [...CATALOG, ...rule.extraMilestones]) {
          if (!def.appliesTo(inputs)) expect(keys).not.toContain(def.key);
          else expect(keys).toContain(def.key);
        }
        // Another country's additions never leak in.
        for (const other of COUNTRY_RULES.filter((entry) => entry.code !== rule.code)) {
          for (const extra of other.extraMilestones) expect(keys).not.toContain(extra.key);
        }
      },
    ),
    { numRuns: 100 },
  );
});

// ── The country examples (task 3.7) ──────────────────────────────────────────

describe("country paths, by worked example", () => {
  const withCountry = (country: string): RoadmapInputs => ({
    ...emptyInputs(),
    degree: "master",
    cgpa: { value: 3.4, scale: 4 },
    targetCountry: country,
    intake: { term: "fall", year: 2027 },
  });

  test("Germany's path carries the APS and blocked-account steps", () => {
    const keys = keysOf(withCountry("Germany"));
    expect(keys).toContain("aps_germany");
    expect(keys).toContain("blocked_account_germany");
    // APS sits behind the transcripts it verifies.
    const aps = milestoneByKey("aps_germany");
    expect(aps).toBeNull(); // a country addition, not a catalog entry
    expect(keys.indexOf("aps_germany")).toBeGreaterThan(keys.indexOf("transcripts"));
  });

  test("Canada's path carries proof of funds and the PAL", () => {
    const keys = keysOf(withCountry("canada"));
    expect(keys).toContain("proof_of_funds_canada");
    expect(keys).toContain("pal_canada");
  });

  test("each of the five countries resolves through every alias it declares", () => {
    for (const rule of COUNTRY_RULES) {
      for (const alias of rule.aliases) {
        const resolved = resolveCountry(alias.toUpperCase());
        expect(resolved.source).toBe("rules");
        expect(resolved.rule.code).toBe(rule.code);
      }
    }
    expect(COUNTRY_RULES).toHaveLength(5);
    expect(resolveCountry(null).rule).toBe(GENERIC_RULE);
    expect(resolveCountry("Bhutan").source).toBe("generic");
  });

  test("a waived English requirement removes the test step and nothing else", () => {
    const base = withCountry("Germany");
    const waived: RoadmapInputs = {
      ...base,
      english: { type: "moi", band: null, status: "waived", testDate: null },
    };
    const keys = keysOf(waived);
    expect(keys).not.toContain("english_test");
    // `apply` depended on it and must still be reachable.
    expect(keys).toContain("apply");
    const apply = buildRoadmap({ inputs: waived, progress: [], now: NOW }).milestones.find(
      (milestone) => milestone.key === "apply",
    )!;
    expect(apply.dependsOn).not.toContain("english_test");
  });
});

// ── Copy tables ──────────────────────────────────────────────────────────────

describe("catalog copy", () => {
  test("the twelve keys are the country-independent set, in catalog order", () => {
    expect([...CATALOG_KEYS]).toEqual([
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
    ]);
  });

  test("apply and visa carry no Evidence_Requirement and are never auto-satisfied", () => {
    for (const key of ["apply", "visa"] as const) {
      const def = milestoneByKey(key)!;
      expect(def.evidence).toBeNull();
      expect(def.isSatisfied(emptyInputs())).toBe(false);
      // …not even for a profile where everything else is proven.
      expect(
        def.isSatisfied({
          ...emptyInputs(),
          hasCvRow: true,
          bookmarkCount: 20,
          docs: { passport: "ready", sop: "ready", transcripts: "ready", lor_count: 5 },
        }),
      ).toBe(false);
    }
  });

  test("every milestone a weakness resolves to exists in some path", () => {
    const everyKey = new Set([...CATALOG_KEYS, ...ALL_EXTRA_MILESTONES.map((def) => def.key)]);
    for (const key of Object.values(WEAKNESS_RESOLVER)) expect(everyKey).toContain(key);
  });

  test("every strength and weakness key has non-empty fallback copy in both languages", () => {
    for (const [key, copy] of Object.entries(NOTE_COPY)) {
      expect(copy.en.trim(), `${key}.en`).not.toBe("");
      expect(copy.bn.trim(), `${key}.bn`).not.toBe("");
    }
    for (const key of Object.keys(WEAKNESS_RESOLVER)) expect(NOTE_COPY).toHaveProperty(key);
  });

  test("every mentor seed reads as the student's own opening line, in both languages", () => {
    for (const [key, seed] of Object.entries(MENTOR_SEEDS)) {
      expect(seed.en.trim(), `${key}.en`).not.toBe("");
      expect(seed.bn.trim(), `${key}.bn`).not.toBe("");
    }
  });
});

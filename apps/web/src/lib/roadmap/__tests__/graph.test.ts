import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { describe, expect, test, vi } from "vitest";

import { CATALOG, type MilestoneDef } from "../catalog";
import { COUNTRY_RULES, GENERIC_RULE, resolveCountry } from "../country-rules";
import {
  CycleError,
  DAY_MS,
  TIGHT_GRACE_DAYS,
  assessFeasibility,
  buildRoadmap,
  dhakaDateString,
  dhakaDayStart,
  dhakaDaysBetween,
  intakeStart,
  nextIntakeAfter,
  topoSort,
  unlockedBetween,
  type ProgressRow,
} from "../graph";
import { CONFIDENCE_FLOOR, type IntakeTerm, type MilestoneKey, type RoadmapInputs } from "../types";
import { arbNow, arbProgressRows, arbRoadmapInputs } from "./arbitraries";
import { PERSONAS, emptyInputs } from "./personas";

/** The database boundary, as a recording stub. The engine never imports it, so
 *  any entry in `dbCalls` is a failure — and mocking the module also keeps
 *  `utils/db`'s `DATABASE_URL` guard out of a suite that has no database. */
const boundary = vi.hoisted(() => ({ dbCalls: [] as string[] }));

vi.mock("@/utils/db", () => ({
  sql: (...args: unknown[]) => {
    boundary.dbCalls.push(`sql(${args.length})`);
    return Promise.resolve([]);
  },
  sqlQuery: (text: string) => {
    boundary.dbCalls.push(`sqlQuery(${text.slice(0, 20)})`);
    return Promise.resolve([]);
  },
}));

const NOW = Date.UTC(2026, 0, 15, 3, 0, 0); // 09:00 in Dhaka, 15 January 2026

const dayValueOf = (isoDate: string) => Date.parse(`${isoDate}T00:00:00.000Z`);

const anchorOf = (inputs: RoadmapInputs) => {
  const { rule } = resolveCountry(inputs.targetCountry);
  return inputs.intake ? intakeStart(inputs.intake.term, inputs.intake.year, rule) : null;
};

// ── Property 20 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 20: For any RoadmapInputs, every milestone appears
// after each of its dependencies present in the path; planned due dates are
// non-decreasing along that order and each equals the intake start minus the
// summed durations downstream of it; for any two timestamps inside the same
// Asia/Dhaka calendar day, every planned due date and the time-to-intake value are
// identical; and for any dependency graph containing a cycle, the sort throws an
// error whose reported keys form a cycle.
test("ordering and dates respect the graph and the Dhaka day", () => {
  fc.assert(
    fc.property(
      arbRoadmapInputs(),
      arbProgressRows(),
      arbNow(),
      fc.integer({ min: 0, max: DAY_MS - 1 }),
      fc.integer({ min: 0, max: DAY_MS - 1 }),
      fc.constantFrom(...CATALOG.map((def) => def.key)),
      (inputs, progress, now, offsetA, offsetB, cycleVictim) => {
        const roadmap = buildRoadmap({ inputs, progress, now });
        const { milestones } = roadmap;
        const position = new Map(milestones.map((milestone, index) => [milestone.key, index]));

        // (a) every dependency present in the path comes first
        for (const milestone of milestones) {
          for (const dep of milestone.dependsOn) {
            expect(position.get(dep), `${dep} before ${milestone.key}`).toBeLessThan(
              position.get(milestone.key)!,
            );
          }
        }

        // (b) due dates are non-decreasing along that order …
        for (let i = 1; i < milestones.length; i += 1) {
          expect(milestones[i].dueBy >= milestones[i - 1].dueBy).toBe(true);
        }

        // … and each is the anchor minus everything downstream of it. The last
        // milestone's own due date is the anchor, which is the intake start
        // whenever one is stored.
        if (milestones.length > 0) {
          const anchor = dayValueOf(milestones[milestones.length - 1].dueBy);
          const storedIntake = anchorOf(inputs);
          if (storedIntake !== null) expect(anchor).toBe(storedIntake);

          let downstreamDays = 0;
          for (let i = milestones.length - 1; i >= 0; i -= 1) {
            expect(milestones[i].dueBy).toBe(dhakaDateString(anchor - downstreamDays * DAY_MS));
            downstreamDays += milestones[i].etaDays;
          }
        }

        // (c) two instants inside one Dhaka day are the same day
        const dhakaMidnight = dhakaDayStart(now) - 6 * 60 * 60 * 1000;
        const first = buildRoadmap({ inputs, progress, now: dhakaMidnight + offsetA });
        const second = buildRoadmap({ inputs, progress, now: dhakaMidnight + offsetB });
        expect(first.milestones.map((m) => m.dueBy)).toEqual(
          second.milestones.map((m) => m.dueBy),
        );
        expect(first.timeToIntakeDays).toBe(second.timeToIntakeDays);

        // (d) a cycle is reported, and every key it names has a dependency
        // inside the reported set — which is what makes the set a cycle.
        const cyclic: MilestoneDef[] = CATALOG.map((def) =>
          def.key === "profile_basics"
            ? { ...def, dependsOn: [...def.dependsOn, "visa" as MilestoneKey] }
            : def.key === cycleVictim
              ? def
              : def,
        );
        let thrown: unknown = null;
        try {
          topoSort(cyclic);
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(CycleError);
        const reported = new Set((thrown as CycleError).keys);
        expect(reported.has("profile_basics")).toBe(true);
        expect(reported.has("visa")).toBe(true);
        for (const key of reported) {
          const def = cyclic.find((entry) => entry.key === key)!;
          expect(def.dependsOn.some((dep) => reported.has(dep)), `${key} has no dep in cycle`).toBe(
            true,
          );
        }
      },
    ),
    { numRuns: 100 },
  );
});

// ── Property 21 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 21: For any pair of remaining-duration and
// time-to-intake day counts, feasibility is on-track when remaining is at most
// time-to-intake, tight when the overrun is at most 30 days, and not-feasible
// beyond that; and for any stored intake starting before the current Dhaka day,
// feasibility is not-feasible with a suggested intake of the same term in a later
// year.
test("feasibility is a total band function, and a past intake rolls forward", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -400, max: 900 }),
      fc.integer({ min: -400, max: 900 }),
      arbRoadmapInputs(),
      arbNow(),
      fc.constantFrom<IntakeTerm>("spring", "summer", "fall", "winter"),
      (remaining, timeToIntake, base, now, term) => {
        // (a) the bands, over every pair including negative day counts
        const band = assessFeasibility(remaining, timeToIntake);
        if (remaining <= timeToIntake) expect(band).toBe("on-track");
        else if (remaining <= timeToIntake + TIGHT_GRACE_DAYS) expect(band).toBe("tight");
        else expect(band).toBe("not-feasible");

        // (b) an intake that already started rolls forward
        const { rule } = resolveCountry(base.targetCountry);
        // Two years back is unambiguously in the past for any term and country.
        const pastYear = new Date(dhakaDayStart(now)).getUTCFullYear() - 2;
        const inputs: RoadmapInputs = { ...base, intake: { term, year: pastYear } };
        const roadmap = buildRoadmap({ inputs, progress: [], now });

        expect(roadmap.timeToIntakeDays).toBeLessThan(0);
        expect(roadmap.feasibility).toBe("not-feasible");
        expect(roadmap.suggestedIntake).not.toBeNull();
        expect(roadmap.suggestedIntake!.term).toBe(term);
        expect(roadmap.suggestedIntake!.year).toBeGreaterThan(pastYear);
        // The suggestion is actually viable: it starts after today.
        expect(
          intakeStart(roadmap.suggestedIntake!.term, roadmap.suggestedIntake!.year, rule),
        ).toBeGreaterThan(dhakaDayStart(now));
      },
    ),
    { numRuns: 100 },
  );
});

// ── Property 14 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 14: For any roadmap with at least one milestone whose
// dependencies are all satisfied, next_action names such a milestone, and no other
// available milestone beats it under (projected gain descending, planned due date
// ascending, catalog priority ascending).
test("the next action is the maximum under the stated order", () => {
  fc.assert(
    fc.property(arbRoadmapInputs(), arbProgressRows(), arbNow(), (inputs, progress, now) => {
      const roadmap = buildRoadmap({ inputs, progress, now });
      const settled = new Set(
        roadmap.milestones
          .filter((m) => m.status === "done" || m.status === "skipped")
          .map((m) => m.key),
      );
      const available = roadmap.milestones.filter(
        (milestone) =>
          !settled.has(milestone.key) && milestone.dependsOn.every((dep) => settled.has(dep)),
      );

      if (available.length === 0) {
        expect(roadmap.nextAction).toBeNull();
        return;
      }

      expect(roadmap.nextAction).not.toBeNull();
      const chosen = available.find((m) => m.key === roadmap.nextAction!.key);
      expect(chosen, `${roadmap.nextAction!.key} is not available`).toBeDefined();
      expect(roadmap.nextAction!.projectedGain).toBe(chosen!.projectedGain);
      expect(roadmap.nextAction!.readiness).toBe(roadmap.readiness);
      expect(roadmap.nextAction!.projectedReadiness).toBe(chosen!.projectedReadiness);
      expect(roadmap.nextAction!.evidenceLabel).toEqual(chosen!.evidenceLabel);

      const beats = (a: typeof chosen, b: typeof chosen) => {
        if (a!.projectedGain !== b!.projectedGain) return a!.projectedGain > b!.projectedGain;
        if (a!.dueBy !== b!.dueBy) return a!.dueBy < b!.dueBy;
        return a!.priority < b!.priority;
      };
      for (const other of available) {
        if (other.key === chosen!.key) continue;
        expect(beats(other, chosen), `${other.key} beats ${chosen!.key}`).toBe(false);
      }
    }),
    { numRuns: 100 },
  );
});

// ── Property 6 ───────────────────────────────────────────────────────────────

// Feature: roadmap, Property 6: For any RoadmapInputs, running buildRoadmap with
// the network boundary, the database boundary and the clock replaced by recording
// stubs results in zero calls to any of them.
test("the engine performs no I/O", () => {
  const calls: string[] = [];

  const RealDate = globalThis.Date;
  class RecordingDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) calls.push("new Date()");
      // @ts-expect-error — forwarding an arbitrary Date argument list
      super(...args);
    }
    static now() {
      calls.push("Date.now");
      return RealDate.now();
    }
  }

  const realFetch = globalThis.fetch;
  const realPerformanceNow = globalThis.performance.now;
  const realRandom = Math.random;

  boundary.dbCalls.length = 0;

  globalThis.fetch = (async () => {
    calls.push("fetch");
    return new Response("{}");
  }) as typeof fetch;
  globalThis.Date = RecordingDate as DateConstructor;
  globalThis.performance.now = () => {
    calls.push("performance.now");
    return 0;
  };
  Math.random = () => {
    calls.push("Math.random");
    return 0;
  };

  try {
    fc.assert(
      fc.property(arbRoadmapInputs(), arbProgressRows(), arbNow(), (inputs, progress, now) => {
        const roadmap = buildRoadmap({ inputs, progress, now });
        // A real roadmap, not an early return: the assertion is meaningless if
        // nothing was built.
        expect(roadmap.milestones.length).toBeGreaterThan(0);
        expect(calls).toEqual([]);
        expect(boundary.dbCalls).toEqual([]);
      }),
      { numRuns: 100 },
    );
  } finally {
    globalThis.fetch = realFetch;
    globalThis.Date = RealDate;
    globalThis.performance.now = realPerformanceNow;
    Math.random = realRandom;
  }

  expect(calls).toEqual([]);
  expect(boundary.dbCalls).toEqual([]);
});

// ── The Dhaka day convention ─────────────────────────────────────────────────

describe("the Dhaka day", () => {
  const sourceOf = (path: string) =>
    readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

  test("uses the same offset and the same local-midnight expression as the push digest", () => {
    const digest = sourceOf("../../../app/api/cron/push-digest/route.ts");
    const graph = sourceOf("../graph.ts");
    const offset = "const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;";
    expect(digest).toContain(offset);
    expect(graph).toContain(offset);
    // Same floor-to-a-day expression, so the two files cannot drift into two
    // date conventions.
    expect(digest).toContain("Math.floor((ms + DHAKA_OFFSET_MS) / 86_400_000) * 86_400_000");
    expect(graph).toContain("Math.floor((ms + DHAKA_OFFSET_MS) / DAY_MS) * DAY_MS");
  });

  test("a Dhaka day runs from 18:00 UTC to 18:00 UTC", () => {
    // 15 January 2026, 23:30 in Dhaka = 17:30 UTC — still the 15th.
    expect(dhakaDateString(Date.UTC(2026, 0, 15, 17, 30))).toBe("2026-01-15");
    // 00:30 in Dhaka on the 16th = 18:30 UTC on the 15th.
    expect(dhakaDateString(Date.UTC(2026, 0, 15, 18, 30))).toBe("2026-01-16");
  });

  test("day counts are local-midnight to local-midnight", () => {
    const from = Date.UTC(2026, 0, 15, 17, 0); // 23:00 Dhaka on the 15th
    const to = Date.UTC(2026, 0, 16, 3, 0); // 09:00 Dhaka on the 16th
    expect(dhakaDaysBetween(from, to)).toBe(1);
    expect(dhakaDaysBetween(to, from)).toBe(-1);
    expect(dhakaDaysBetween(from, from + 60_000)).toBe(0);
  });

  test("an intake starts on the first Dhaka day of its country's month", () => {
    const germany = COUNTRY_RULES.find((rule) => rule.code === "germany")!;
    const canada = COUNTRY_RULES.find((rule) => rule.code === "canada")!;
    // Wintersemester in October, not January.
    expect(dhakaDateString(intakeStart("winter", 2026, germany))).toBe("2026-10-01");
    expect(dhakaDateString(intakeStart("winter", 2026, canada))).toBe("2026-01-01");
    expect(dhakaDateString(intakeStart("fall", 2026, GENERIC_RULE))).toBe("2026-09-01");
  });

  test("nextIntakeAfter clears both today and the intake it was given", () => {
    const germany = COUNTRY_RULES.find((rule) => rule.code === "germany")!;
    // A past intake rolls to the first one still ahead.
    expect(nextIntakeAfter("fall", 2024, NOW, germany)).toEqual({ term: "fall", year: 2026 });
    // An intake still ahead rolls to the following year, because suggesting the
    // one the student is already failing would be no suggestion.
    expect(nextIntakeAfter("fall", 2026, NOW, germany)).toEqual({ term: "fall", year: 2027 });
  });
});

// ── Status merging and unlocking, by worked example ──────────────────────────

describe("status merge", () => {
  const scored: RoadmapInputs = {
    ...emptyInputs(),
    degree: "master",
    cgpa: { value: 3.4, scale: 4 },
    targetCountry: "Germany",
    intake: { term: "fall", year: 2027 },
  };

  const row = (overrides: Partial<ProgressRow> & { milestone_key: string }): ProgressRow => ({
    status: "todo",
    progress: null,
    manual_override: false,
    completed_at: null,
    celebrated_at: null,
    ...overrides,
  });

  const find = (inputs: RoadmapInputs, progress: ProgressRow[], key: MilestoneKey) =>
    buildRoadmap({ inputs, progress, now: NOW }).milestones.find((m) => m.key === key)!;

  test("stored evidence auto-satisfies, and the source says so", () => {
    const milestone = find(scored, [], "profile_basics");
    expect(milestone.status).toBe("done");
    expect(milestone.source).toBe("auto");
    expect(milestone.state).toBe("done");
  });

  test("a manual override wins over auto-satisfaction", () => {
    const milestone = find(
      scored,
      [row({ milestone_key: "profile_basics", status: "in_progress", manual_override: true })],
      "profile_basics",
    );
    expect(milestone.status).toBe("in_progress");
    expect(milestone.source).toBe("manual");
  });

  test("a stored status without an override is kept, and reports no source", () => {
    const milestone = find(scored, [row({ milestone_key: "passport", status: "skipped" })], "passport");
    expect(milestone.status).toBe("skipped");
    expect(milestone.source).toBe("none");
    expect(milestone.state).toBe("skipped");
  });

  test("a stored key outside the path is ignored rather than returned", () => {
    const roadmap = buildRoadmap({
      inputs: scored,
      progress: [
        row({ milestone_key: "pal_canada", status: "done", manual_override: true }),
        row({ milestone_key: "retired_key_from_v0", status: "done", manual_override: true }),
      ],
      now: NOW,
    });
    const keys = roadmap.milestones.map((m) => m.key);
    expect(keys).not.toContain("pal_canada");
    expect(keys).not.toContain("retired_key_from_v0");
    // …and Germany's own additions are there.
    expect(keys).toContain("aps_germany");
  });

  test("exactly one milestone is active, and it is the first with its dependencies met", () => {
    const roadmap = buildRoadmap({ inputs: scored, progress: [], now: NOW });
    const active = roadmap.milestones.filter((m) => m.state === "active");
    expect(active).toHaveLength(1);
    const firstOpen = roadmap.milestones.find(
      (m) => m.status !== "done" && m.status !== "skipped" && m.dependsOn.every((dep) => {
        const target = roadmap.milestones.find((entry) => entry.key === dep)!;
        return target.status === "done" || target.status === "skipped";
      }),
    );
    expect(active[0].key).toBe(firstOpen!.key);
  });

  test("a skipped dependency settles rather than deadlocks the path", () => {
    // profile_basics and passport are auto-done for this profile, so with
    // target_choice skipped the English test is the first still-open milestone —
    // it would be locked forever if a skipped dependency never settled.
    const roadmap = buildRoadmap({
      inputs: { ...scored, docs: { passport: "ready" } },
      progress: [row({ milestone_key: "target_choice", status: "skipped", manual_override: true })],
      now: NOW,
    });
    const english = roadmap.milestones.find((m) => m.key === "english_test")!;
    expect(english.state).toBe("active");
  });

  test("unlockedBetween names what a completion opened, and not the completion itself", () => {
    const before = buildRoadmap({ inputs: scored, progress: [], now: NOW });
    const after = buildRoadmap({
      inputs: scored,
      progress: [row({ milestone_key: "target_choice", status: "done", manual_override: true })],
      now: NOW,
    });
    // target_choice is auto-satisfied for this profile already, so nothing moves.
    expect(unlockedBetween(before, after)).toEqual([]);

    const withoutCountry: RoadmapInputs = { ...scored, targetCountry: null };
    const closed = buildRoadmap({ inputs: withoutCountry, progress: [], now: NOW });
    const opened = buildRoadmap({
      inputs: withoutCountry,
      progress: [row({ milestone_key: "target_choice", status: "done", manual_override: true })],
      now: NOW,
    });
    const unlocked = unlockedBetween(closed, opened);
    expect(unlocked).toContain("english_test");
    expect(unlocked).toContain("shortlist");
    expect(unlocked).not.toContain("target_choice");
  });
});

// ── Projection on the path ───────────────────────────────────────────────────

describe("projection", () => {
  test("a milestone self-reported done with absent evidence dangles no points", () => {
    const inputs: RoadmapInputs = {
      ...emptyInputs(),
      degree: "master",
      cgpa: { value: 3.4, scale: 4 },
      english: { type: "ielts", band: null, status: "not_started", testDate: null },
      targetCountry: "Germany",
      intake: { term: "fall", year: 2027 },
    };
    const claimed = buildRoadmap({
      inputs,
      progress: [
        {
          milestone_key: "english_test",
          status: "done",
          progress: null,
          manual_override: true,
          completed_at: "2026-01-10T00:00:00.000Z",
          celebrated_at: "2026-01-10T00:00:00.000Z",
        },
      ],
      now: NOW,
    });
    const english = claimed.milestones.find((m) => m.key === "english_test")!;
    expect(english.status).toBe("done");
    expect(english.evidenceSatisfied).toBe(false);
    expect(english.projectedGain).toBe(0);
    expect(english.evidenceLabel?.en).toBe("your English test score");
    expect(english.evidenceLabel?.bn).not.toBe("");

    // The same milestone, not yet claimed, still advertises the real gain.
    const open = buildRoadmap({ inputs, progress: [], now: NOW });
    const openEnglish = open.milestones.find((m) => m.key === "english_test")!;
    expect(openEnglish.projectedGain).toBeGreaterThan(0);
  });
});

// ── The persona graph blocks ─────────────────────────────────────────────────

describe.each(PERSONAS.filter((persona) => persona.graph))("$name — graph", (persona) => {
  const graph = persona.graph!;
  // The pastIntake fixture stores fall 2024, and its expected roll-forward is
  // "next", so the clock has to sit in the year after it for both readings of
  // that word to agree.
  const now = persona.name === "Past intake" ? Date.UTC(2025, 0, 15, 3, 0, 0) : NOW;
  const roadmap = buildRoadmap({ inputs: persona.inputs, progress: [], now });

  test("path membership", () => {
    for (const key of graph.pathIncludes ?? []) {
      expect(roadmap.milestones.map((m) => m.key)).toContain(key);
    }
  });

  test("country source", () => {
    if (graph.countrySource) expect(roadmap.countrySource).toBe(graph.countrySource);
  });

  test("feasibility and roll-forward", () => {
    if (graph.feasibility) expect(roadmap.feasibility).toBe(graph.feasibility);
    if (graph.suggestedIntake) {
      expect(roadmap.suggestedIntake).not.toBeNull();
      expect(roadmap.suggestedIntake!.term).toBe(graph.suggestedIntake.term);
      expect(roadmap.suggestedIntake!.year).toBe(persona.inputs.intake!.year + 1);
    } else {
      expect(roadmap.suggestedIntake).toBeNull();
    }
  });

  test("entry point", () => {
    // The fixtures' `entryPoint` is the design's `setup` display state — readiness
    // withheld *and* the confidence floor uncleared — not `roadmap_onboarded_at`,
    // which is the client's own routing input (Req 15.7). Fresh graduate, Germany
    // carries no `onboardedAt` and still expects the journey.
    const entryPoint =
      roadmap.readiness === null && roadmap.confidence < CONFIDENCE_FLOOR ? "wizard" : "journey";
    expect(entryPoint).toBe(graph.entryPoint);
  });

  test("every milestone carries a due date and bilingual copy", () => {
    for (const milestone of roadmap.milestones) {
      expect(milestone.dueBy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(milestone.title.bn.trim()).not.toBe("");
      expect(milestone.description.bn.trim()).not.toBe("");
    }
  });
});

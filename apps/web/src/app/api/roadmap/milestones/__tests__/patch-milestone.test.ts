import fc from "fast-check";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { MilestonePatchResponse, RoadmapResponse } from "@scholarhub/shared";
import { CATALOG } from "@/lib/roadmap/catalog";
import { COUNTRY_RULES } from "@/lib/roadmap/country-rules";
import { createRoadmapDbDouble, type RoadmapDbDouble } from "@/test-support/sql-double";

/**
 * `PATCH /api/roadmap/milestones/[key]` against a database double.
 *
 * The one rule every test here circles: a status write advances the path and
 * moves the score by zero. `delta` is computed from two engine runs rather than
 * hardcoded, so if a future change ever let `milestone_progress` reach the
 * scorer, these tests are what would notice.
 */

const state = vi.hoisted(() => ({
  userId: "user_test" as string | null,
  db: null as null | {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
    sqlQuery: (text: string, params?: unknown[]) => Promise<unknown[]>;
  },
  fetches: [] as string[],
}));

vi.mock("@/utils/db", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
    if (!state.db) throw new Error("db double not installed");
    return state.db.sql(strings, ...values);
  },
  sqlQuery: (text: string, params?: unknown[]) => {
    if (!state.db) throw new Error("db double not installed");
    return state.db.sqlQuery(text, params);
  },
}));

vi.mock("@/utils/api-auth", () => ({
  getUser: async () => (state.userId ? { userId: state.userId } : null),
}));

const { PATCH } = await import("../[key]/route");
const { GET } = await import("../../route");

const USER = "user_test";

function scoredProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: USER,
    target_degree: "masters",
    cgpa: "3.65",
    ielts_score: "7.0",
    english_test_status: "scored",
    docs: { passport: "ready", transcripts: "ready" },
    target_country: "Germany",
    target_intake_term: "fall",
    target_intake_year: 2027,
    roadmap_onboarded_at: "2026-01-04T09:00:00.000Z",
    ...overrides,
  };
}

function install(seed: Parameters<typeof createRoadmapDbDouble>[0] = {}): RoadmapDbDouble {
  const double = createRoadmapDbDouble({ userId: USER, ...seed });
  state.db = double;
  return double;
}

async function patch(key: string, body: unknown) {
  const req = { json: async () => body } as never;
  const res = await PATCH(req, { params: Promise.resolve({ key }) });
  return { status: res.status, body: (await res.json()) as MilestonePatchResponse & { error?: string } };
}

async function read() {
  const res = await GET();
  return (await res.json()) as RoadmapResponse;
}

const pillar = (body: RoadmapResponse, key: string) =>
  body.score_breakdown.pillars.find((entry) => entry.pillar === key)!;

/** The declared dependency lists, read straight off the definitions. The wire
 *  shape carries no `depends_on`, so a check on what a write unlocked has to come
 *  from the static data plus the statuses the response reports — which is exactly
 *  what makes it independent of the graph builder under test. */
const DEPENDS_ON: Record<string, readonly string[]> = Object.fromEntries(
  [...CATALOG, ...COUNTRY_RULES.flatMap((rule) => rule.extraMilestones)].map((def) => [
    def.key,
    def.dependsOn,
  ]),
);

const isSettled = (body: RoadmapResponse, key: string) => {
  const milestone = body.milestones.find((entry) => entry.key === key);
  return milestone?.status === "done" || milestone?.status === "skipped";
};

/** The keys whose dependencies present in this path are all settled. */
function dependenciesMet(body: RoadmapResponse): Set<string> {
  const present = new Set(body.milestones.map((milestone) => milestone.key));
  return new Set(
    body.milestones
      .filter((milestone) =>
        (DEPENDS_ON[milestone.key] ?? [])
          .filter((dep) => present.has(dep))
          .every((dep) => isSettled(body, dep)),
      )
      .map((milestone) => milestone.key),
  );
}

beforeEach(() => {
  state.userId = USER;
  state.db = null;
  state.fetches = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    state.fetches.push(String(input));
    return new Response("{}");
  }) as typeof fetch;
});

// ── The route examples (task 3.21) ───────────────────────────────────────────

describe("PATCH /api/roadmap/milestones/[key] — worked examples", () => {
  test("the English test marked done with no band: pillar stays 0, and the prompt names the score", async () => {
    const double = install({
      profile: scoredProfile({ ielts_score: null, english_test_status: "not_started" }),
    });

    const before = await read();
    expect(pillar(before, "english").earned).toBe(0);

    const res = await patch("english_test", { status: "done" });

    expect(res.status).toBe(200);
    expect(res.body.delta).toBe(0);
    expect(res.body.readiness).toBe(before.readiness);
    expect(res.body.evidence_label?.en).toBe("your English test score");
    expect(res.body.evidence_label?.bn.trim()).not.toBe("");

    // The subsequent read agrees: done, still no points, still asking for the band.
    const after = await read();
    expect(pillar(after, "english").earned).toBe(0);
    expect(after.readiness).toBe(before.readiness);
    const english = after.milestones.find((m) => m.key === "english_test")!;
    expect(english.status).toBe("done");
    expect(english.source).toBe("manual");
    expect(english.evidence_satisfied).toBe(false);
    expect(english.projected_gain).toBe(0);
    expect(english.evidence_label?.en).toBe("your English test score");
    expect(double.progressRow("english_test")?.manual_override).toBe(true);
  });

  test("done → todo clears completed_at and keeps manual_override", async () => {
    const double = install({ profile: scoredProfile() });

    await patch("sop", { status: "done" });
    expect(double.progressRow("sop")?.completed_at).not.toBeNull();

    await patch("sop", { status: "todo" });

    const row = double.progressRow("sop")!;
    expect(row.status).toBe("todo");
    expect(row.completed_at).toBeNull();
    expect(row.manual_override).toBe(true);
    // …and celebrated_at is never cleared, so the bloom cannot replay.
    expect(row.celebrated_at).not.toBeNull();
  });

  test("the first completion celebrates and the second does not, including after a round trip", async () => {
    install({ profile: scoredProfile() });

    const first = await patch("sop", { status: "done" });
    expect(first.body.celebrate).toBe(true);

    const second = await patch("sop", { status: "done" });
    expect(second.body.celebrate).toBe(false);

    // todo and back to done: still no second celebration.
    await patch("sop", { status: "todo" });
    const third = await patch("sop", { status: "done" });
    expect(third.body.celebrate).toBe(false);
  });

  test("completing a step reports what it unlocked", async () => {
    // No country stored, so target_choice is open and gates the rest. No English
    // score either, so the test step is genuinely waiting rather than auto-done.
    install({
      profile: scoredProfile({
        target_country: null,
        docs: {},
        ielts_score: null,
        english_test_status: "not_started",
      }),
    });

    const res = await patch("target_choice", { status: "done" });

    expect(res.status).toBe(200);
    expect(res.body.unlocked_keys).toContain("english_test");
    expect(res.body.unlocked_keys).toContain("shortlist");
    expect(res.body.unlocked_keys).not.toContain("target_choice");
  });

  test("the statement is the prior-CTE upsert, with manual_override always true", async () => {
    const double = install({ profile: scoredProfile() });

    await patch("cv", { status: "in_progress" });

    const { text, params } = double.writes[double.writes.length - 1];
    expect(text).toContain("WITH prior AS");
    expect(text).toContain("INSERT INTO milestone_progress");
    expect(text).toContain("ON CONFLICT (user_id, milestone_key) DO UPDATE");
    expect(text).toContain("manual_override = TRUE");
    expect(text).toContain("first_celebration");
    expect(params).toEqual([USER, "cv", "in_progress", null]);
    expect(state.fetches).toEqual([]);
  });

  test("with the evidence already in place, the returned readiness is the projected one", async () => {
    // The passport document is stored, so `passport`'s requirement is met and its
    // projection is "no further gain" — which is what the write must return.
    install({ profile: scoredProfile() });

    const before = await read();
    const passport = before.milestones.find((m) => m.key === "passport")!;
    expect(passport.evidence_satisfied).toBe(true);

    const res = await patch("passport", { status: "done" });

    expect(res.status).toBe(200);
    expect(res.body.readiness).toBe(passport.projected_readiness);
    expect(res.body.readiness).toBe(before.readiness);
    expect(res.body.evidence_label).toBeNull();
  });

  test("a count-tracking step accepts a progress value and derives the status from it", async () => {
    const double = install({ profile: scoredProfile() });

    const partial = await patch("lor", { progress: 2 });
    expect(partial.status).toBe(200);
    expect(double.progressRow("lor")?.status).toBe("in_progress");
    expect(double.progressRow("lor")?.progress).toBe(2);

    const complete = await patch("lor", { progress: 3 });
    expect(complete.status).toBe(200);
    expect(double.progressRow("lor")?.status).toBe("done");
    // Still evidence-gated: three letters *reported* is not three letters stored.
    expect(complete.body.delta).toBe(0);
    expect(complete.body.evidence_label?.en).toBe("at least 2 recommendation letters");
  });
});

// ── Rejections ───────────────────────────────────────────────────────────────

describe("PATCH /api/roadmap/milestones/[key] — rejections", () => {
  test("a key outside the caller's current path is 400 before any write", async () => {
    const double = install({ profile: scoredProfile() }); // Germany

    for (const key of ["pal_canada", "retired_key_from_v0", "", "../../etc/passwd"]) {
      const res = await patch(key, { status: "done" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    }
    expect(double.writes).toHaveLength(0);
    expect(double.progressRows()).toEqual([]);
  });

  test("progress outside 0…targetCount is 400, and so is progress on a step with no count", async () => {
    const double = install({ profile: scoredProfile() });

    for (const progress of [-1, 4, 99, 1.5]) {
      const res = await patch("lor", { progress });
      expect(res.status, `progress ${progress}`).toBe(400);
    }
    // `cv` tracks no count.
    expect((await patch("cv", { progress: 1 })).status).toBe(400);
    expect(double.writes).toHaveLength(0);
  });

  test("an unknown status, an empty body and invalid JSON are all 400", async () => {
    const double = install({ profile: scoredProfile() });

    expect((await patch("cv", { status: "finished" })).status).toBe(400);
    expect((await patch("cv", {})).status).toBe(400);
    expect((await patch("cv", [])).status).toBe(400);
    const broken = await PATCH(
      { json: async () => { throw new Error("bad json"); } } as never,
      { params: Promise.resolve({ key: "cv" }) },
    );
    expect(broken.status).toBe(400);
    expect(double.writes).toHaveLength(0);
  });

  test("an unauthenticated request is 401 with nothing read or written", async () => {
    const double = install({ profile: scoredProfile() });
    state.userId = null;

    const res = await patch("cv", { status: "done" });

    expect(res.status).toBe(401);
    expect(double.reads).toHaveLength(0);
    expect(double.writes).toHaveLength(0);
  });
});

// ── Property 15 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 15: For any RoadmapInputs and for any sequence of
// status and progress writes over arbitrary milestone keys, the readiness and every
// pillar's earned points after the sequence equal their values before it, while
// every milestone whose dependencies became satisfied by those writes is reported
// unlocked.
test("recording a status never moves the score", async () => {
  const arbWrite = fc.record({
    key: fc.constantFrom(
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
      "pal_canada",
      "retired_key_from_v0",
    ),
    status: fc.constantFrom("todo", "in_progress", "done", "skipped"),
  });

  await fc.assert(
    fc.asyncProperty(
      fc.array(arbWrite, { maxLength: 6 }),
      fc.constantFrom("Germany", "Canada", "Bhutan"),
      fc.constantFrom("3.65", "2.80", null),
      async (writes, country, cgpa) => {
        install({ profile: scoredProfile({ target_country: country, cgpa }), bookmarkCount: 4 });

        const first = await read();
        const earnedBefore = first.score_breakdown.pillars.map((entry) => entry.earned);

        for (const write of writes) {
          const before = await read();
          const res = await patch(write.key, { status: write.status });
          if (res.status !== 200) continue;

          // Every accepted write reports a zero delta and the readiness that was
          // already there, whatever it claimed to have finished.
          expect(res.body.delta).toBe(0);
          expect(res.body.readiness).toBe(before.readiness);

          // …and it reports exactly what it opened. `unlocked_keys` is checked
          // against the catalog's declared dependency lists and the wire
          // statuses, not against the graph builder that produced it.
          const after = await read();
          const expected = [...dependenciesMet(after)].filter(
            (key) =>
              !dependenciesMet(before).has(key) &&
              !isSettled(after, key),
          );
          expect(new Set(res.body.unlocked_keys)).toEqual(new Set(expected));
        }

        const last = await read();
        expect(last.readiness).toBe(first.readiness);
        expect(last.score_breakdown.pillars.map((entry) => entry.earned)).toEqual(earnedBefore);
        expect(last.confidence).toBe(first.confidence);
      },
    ),
    { numRuns: 20 },
  );
});

// ── Property 16 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 16: For any RoadmapInputs and for any milestone key
// whose Evidence_Requirement is unsatisfied, marking it done returns the
// pre-request readiness, a delta of 0 and a non-null evidence label, and the
// subsequent roadmap read reports that milestone's projected gain as 0 with the
// same label.
test("an unsatisfied evidence requirement pays zero and says which one", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom("Germany", "Canada", "Bhutan"),
      fc.constantFrom("3.65", "2.80"),
      fc.constantFrom(0, 4),
      async (country, cgpa, bookmarkCount) => {
        install({
          // Nothing in the document map and no CV row, so several requirements are
          // genuinely absent.
          profile: scoredProfile({ target_country: country, cgpa, docs: {} }),
          bookmarkCount,
        });

        const before = await read();
        const unsatisfied = before.milestones.filter(
          (milestone) => !milestone.evidence_satisfied && milestone.evidence_label !== null,
        );
        fc.pre(unsatisfied.length > 0);

        for (const milestone of unsatisfied) {
          const res = await patch(milestone.key, { status: "done" });
          expect(res.status).toBe(200);
          expect(res.body.readiness).toBe(before.readiness);
          expect(res.body.delta).toBe(0);
          expect(res.body.evidence_label).not.toBeNull();
          expect(res.body.evidence_label).toEqual(milestone.evidence_label);
        }

        const after = await read();
        for (const milestone of unsatisfied) {
          const updated = after.milestones.find((entry) => entry.key === milestone.key)!;
          expect(updated.status).toBe("done");
          expect(updated.projected_gain).toBe(0);
          expect(updated.evidence_label).toEqual(milestone.evidence_label);
        }
        expect(after.readiness).toBe(before.readiness);
      },
    ),
    { numRuns: 24 },
  );
});

// ── Property 22 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 22: For any RoadmapInputs and for any set of stored
// progress rows: a milestone with satisfied evidence and no manual override is
// reported done with source auto; a milestone with manual_override is reported with
// its stored status regardless of what auto-satisfaction would say; and for any
// progress integer, the route accepts it exactly when it lies between 0 and that
// milestone's target count.
test("auto-satisfaction and manual override compose predictably", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom("Germany", "Canada", "Bhutan"),
      fc.uniqueArray(
        fc.record({
          milestone_key: fc.constantFrom("passport", "cv", "sop", "transcripts", "lor", "shortlist"),
          status: fc.constantFrom("todo", "in_progress", "done", "skipped"),
          manual_override: fc.boolean(),
        }),
        { selector: (row) => row.milestone_key, maxLength: 6 },
      ),
      fc.integer({ min: -2, max: 8 }),
      fc.constantFrom("lor", "cv"),
      async (country, progressRows, progressValue, progressKey) => {
        const double = install({
          profile: scoredProfile({
            target_country: country,
            docs: { passport: "ready", transcripts: "ready", sop: "ready", lor_count: 3 },
          }),
          bookmarkCount: 6,
          cvCount: 1,
          progress: progressRows,
        });

        const body = await read();
        const stored = new Map<string, (typeof progressRows)[number]>(
          progressRows.map((row) => [row.milestone_key as string, row]),
        );

        for (const milestone of body.milestones) {
          const row = stored.get(milestone.key);
          if (row?.manual_override) {
            // (b) the student's own choice stands, whatever the evidence says.
            expect(milestone.status, milestone.key).toBe(row.status);
            expect(milestone.source, milestone.key).toBe("manual");
            continue;
          }
          if (milestone.evidence_satisfied && milestone.evidence_label === null) {
            // (a) evidence in place and nothing overriding it → auto-done. Steps
            // that carry no evidence at all are excluded: `apply` and `visa` report
            // `evidence_satisfied` true because there is nothing to prove, and
            // proving nothing is not completion.
            const carriesEvidence = !["apply", "visa"].includes(milestone.key);
            if (carriesEvidence) {
              expect(milestone.status, milestone.key).toBe("done");
              expect(milestone.source, milestone.key).toBe("auto");
            }
          }
        }

        // (c) progress is accepted exactly inside 0…targetCount
        const target = body.milestones.find((m) => m.key === progressKey)!.target_count;
        const res = await patch(progressKey, { progress: progressValue });
        const acceptable = target !== null && progressValue >= 0 && progressValue <= target;
        expect(res.status, `${progressKey} progress ${progressValue}`).toBe(acceptable ? 200 : 400);
        if (!acceptable) {
          expect(double.progressRow(progressKey)?.progress ?? null).not.toBe(progressValue);
        }
      },
    ),
    { numRuns: 30 },
  );
});

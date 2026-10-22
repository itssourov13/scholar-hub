import fc from "fast-check";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { RoadmapResponse } from "@scholarhub/shared";
import { createRoadmapDbDouble, type RoadmapDbDouble } from "@/test-support/sql-double";

/**
 * `GET /api/roadmap` against a database double.
 *
 * Two things this file is really guarding. **No AI call happens on the read
 * path** — `fetch` is replaced with a recorder, and every test asserts it stayed
 * untouched. And **nothing a student did is ever deleted**: the progress table is
 * read, filtered against the current path, and left alone.
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

const { GET } = await import("../route");

const USER = "user_test";

/** A profile that clears the readiness gate, so the interesting fields are not
 *  all `null`. */
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

async function get() {
  const res = await GET();
  return { status: res.status, headers: res.headers, body: (await res.json()) as RoadmapResponse };
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

// ── The read path, by worked example ─────────────────────────────────────────

describe("GET /api/roadmap", () => {
  test("returns the deterministic roadmap with no AI call anywhere", async () => {
    const double = install({ profile: scoredProfile(), bookmarkCount: 4, cvCount: 1 });

    const res = await get();

    expect(res.status).toBe(200);
    expect(state.fetches).toEqual([]);
    expect(res.body.engine_version).toBe(1);
    expect(res.body.readiness).toBeTypeOf("number");
    expect(res.body.score_breakdown.pillars).toHaveLength(6);
    expect(res.body.milestones.length).toBeGreaterThan(0);
    expect(res.body.next_action).not.toBeNull();
    expect(res.body.narration_status).toBe("pending");
    expect(res.body.onboarded).toBe(true);
    // Germany's own steps are in the path.
    expect(res.body.milestones.map((m) => m.key)).toContain("aps_germany");
    // Every milestone renders in both languages without narration.
    for (const milestone of res.body.milestones) {
      expect(milestone.title.bn.trim()).not.toBe("");
      expect(milestone.why.en.trim()).not.toBe("");
      expect(milestone.why.bn.trim()).not.toBe("");
      expect(milestone.due_by).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(res.body.mentor.en.trim()).not.toBe("");
    expect(res.body.mentor.bn.trim()).not.toBe("");
    expect(double.roadmapRow()).not.toBeNull();
  });

  test("reads four user-scoped statements and the guide slugs, in one round trip", async () => {
    const double = install({ profile: scoredProfile() });

    await get();

    expect(double.reads).toHaveLength(5);
    const tables = double.reads.map((read) => read.text);
    expect(tables.some((text) => /FROM profiles/.test(text))).toBe(true);
    expect(tables.some((text) => /FROM user_bookmarks/.test(text))).toBe(true);
    expect(tables.some((text) => /FROM user_cvs/.test(text))).toBe(true);
    expect(tables.some((text) => /FROM milestone_progress/.test(text))).toBe(true);
    expect(tables.some((text) => /FROM guides/.test(text))).toBe(true);

    for (const read of double.reads) {
      // The published-guide lookup is the one read that is not per-student. It
      // binds nothing at all, which is what keeps it outside the scoping rule
      // rather than an exception to it.
      if (/FROM guides/.test(read.text)) expect(read.values).toEqual([]);
      else expect(read.values).toContain(USER);
    }
  });

  // ── Guide actions never point at a 404 ─────────────────────────────────────
  //
  // Catalog slugs name the guide a step *should* link to, and none of them are
  // written yet. A student tapping "Read the guide" must not land on a not-found
  // page, so the wire layer resolves each slug against what is actually
  // published: the slug itself when it exists, a same-topic stand-in when one is
  // listed, and the mentor when neither holds.

  test("an unwritten guide slug degrades to the mentor rather than a dead link", async () => {
    install({ profile: scoredProfile(), publishedGuides: [] });

    const res = await get();

    const guides = res.body.milestones.filter((m) => m.action.kind === "guide");
    expect(guides).toEqual([]);
    // The steps that wanted a guide are still present and still actionable.
    expect(res.body.milestones.some((m) => m.action.kind === "mentor")).toBe(true);
    for (const milestone of res.body.milestones) {
      if (milestone.action.kind === "mentor") expect(milestone.action.seed_key).not.toBe("");
    }
  });

  test("a published stand-in is preferred over the mentor", async () => {
    install({
      profile: scoredProfile(),
      publishedGuides: ["ielts-score-required-for-top-scholarships"],
    });

    const res = await get();

    const slugs = res.body.milestones
      .map((m) => (m.action.kind === "guide" ? m.action.slug : null))
      .filter((slug): slug is string => slug !== null);
    expect(slugs).toContain("ielts-score-required-for-top-scholarships");
    // The unwritten slug itself never reaches a client.
    expect(slugs).not.toContain("ielts-preparation");
  });

  test("the catalog slug wins once the real guide is written", async () => {
    install({ profile: scoredProfile(), publishedGuides: ["ielts-preparation"] });

    const res = await get();

    const slugs = res.body.milestones
      .map((m) => (m.action.kind === "guide" ? m.action.slug : null))
      .filter((slug): slug is string => slug !== null);
    expect(slugs).toContain("ielts-preparation");
    expect(slugs).not.toContain("ielts-score-required-for-top-scholarships");
  });

  test("every guide action a client receives is a published slug", async () => {
    const published = [
      "ielts-score-required-for-top-scholarships",
      "essential-documents-for-studying-abroad-checklist",
      "scholarship-application-documents-guide",
      "bidyeshe-porar-journey-step-by-step-guide",
    ];
    install({ profile: scoredProfile(), publishedGuides: published });

    const res = await get();

    for (const milestone of res.body.milestones) {
      if (milestone.action.kind === "guide") expect(published).toContain(milestone.action.slug);
    }
  });

  test("persists with one statement that upserts on the user id", async () => {
    const double = install({ profile: scoredProfile() });

    await get();

    expect(double.writes).toHaveLength(1);
    const { text, params } = double.writes[0];
    expect(text).toContain("INSERT INTO roadmaps");
    expect(text).toContain("ON CONFLICT (user_id) DO UPDATE");
    expect(text).toContain("previous_readiness      = CASE WHEN roadmaps.readiness IS DISTINCT FROM");
    expect(text).toContain("narration               = CASE WHEN roadmaps.profile_fingerprint =");
    expect(params[0]).toBe(USER);
    // No progress row is written by a read.
    expect(double.progressRows()).toEqual([]);
  });

  test("sets Cache-Control: private, no-store", async () => {
    install({ profile: scoredProfile() });
    const res = await get();
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("an unauthenticated request is 401 with no statement issued", async () => {
    const double = install({ profile: scoredProfile() });
    state.userId = null;

    const res = await GET();

    expect(res.status).toBe(401);
    expect(double.reads).toHaveLength(0);
    expect(double.writes).toHaveLength(0);
  });

  test("a missing profile row is 404 and writes nothing", async () => {
    const double = install({ profile: null });

    const res = await GET();

    expect(res.status).toBe(404);
    expect(double.writes).toHaveLength(0);
  });

  test("an empty profile reports readiness null, no weaknesses and the generic path", async () => {
    install({ profile: { id: USER } });

    const res = await get();

    expect(res.body.readiness).toBeNull();
    expect(res.body.confidence).toBe(0);
    expect(res.body.weaknesses).toEqual([]);
    expect(res.body.country_source).toBe("generic");
    expect(res.body.onboarded).toBe(false);
    expect(res.body.milestones.map((m) => m.key)).not.toContain("aps_germany");
    // The score is withheld, and the path still renders.
    expect(res.body.milestones.length).toBeGreaterThan(0);
  });

  test("a stored key outside the current path is filtered out and left in the table", async () => {
    const double = install({
      profile: scoredProfile(), // Germany
      progress: [
        { milestone_key: "pal_canada", status: "done", manual_override: true },
        { milestone_key: "retired_key_from_v0", status: "done", manual_override: true },
      ],
    });

    const res = await get();

    const keys = res.body.milestones.map((m) => m.key);
    expect(keys).not.toContain("pal_canada");
    expect(keys).not.toContain("retired_key_from_v0");
    // Still in the table, untouched.
    expect(double.progressRow("pal_canada")?.status).toBe("done");
    expect(double.progressRow("retired_key_from_v0")?.status).toBe("done");
  });

  test("a stored narration is served back, and a note carries engine copy without one", async () => {
    const double = install({ profile: scoredProfile() });
    // First read establishes the fingerprint.
    await get();
    const fingerprint = double.roadmapRow()!.profile_fingerprint;

    // Simulate task 4 landing a narration against that same fingerprint.
    const narrated = install({
      profile: scoredProfile(),
      roadmap: {
        ...double.roadmapRow()!,
        profile_fingerprint: fingerprint,
        narration: {
          milestones: { passport: { en: "Yours expires next year.", bn: "আপনার পাসপোর্টের মেয়াদ শেষ হবে আগামী বছর।" } },
          mentor: { en: "Book the test.", bn: "টেস্টের তারিখ নিন।" },
        },
        narration_status: "ready",
      },
    });

    const res = await get();

    expect(res.body.narration_status).toBe("ready");
    expect(res.body.milestones.find((m) => m.key === "passport")!.why.en).toBe(
      "Yours expires next year.",
    );
    expect(res.body.mentor.en).toBe("Book the test.");
    // A milestone the narrator did not mention still carries catalog copy.
    const cv = res.body.milestones.find((m) => m.key === "cv")!;
    expect(cv.why.en.trim()).not.toBe("");
    expect(narrated.writes).toHaveLength(1);
  });

  test("a weakness carries engine phrasing and the milestone that resolves it", async () => {
    install({ profile: scoredProfile({ docs: { passport: "ready" } }) });

    const res = await get();

    expect(res.body.weaknesses.length).toBeGreaterThan(0);
    for (const note of res.body.weaknesses) {
      expect(note.text.en.trim()).not.toBe("");
      expect(note.text.bn.trim()).not.toBe("");
      expect(note.milestone_key).not.toBeNull();
      expect(res.body.milestones.map((m) => m.key)).toContain(note.milestone_key!);
    }
  });

  test("the mentor line states the lift when there is one", async () => {
    install({ profile: scoredProfile({ docs: {} }) });

    const res = await get();

    expect(res.body.next_action!.projected_gain).toBeGreaterThan(0);
    expect(res.body.mentor.en).toContain("%");
    expect(res.body.mentor.bn).toContain("%");
  });
});

// ── Property 24 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 24: For any RoadmapInputs, a read whose recomputed
// fingerprint matches the stored one returns the stored narration and status
// unchanged; for any mutation that changes the fingerprint, the next read reports
// narration_status: 'pending' with the narration cleared; and for any readiness
// change, the response carries the prior readiness together with the engine
// version that produced it.
test("the cache turns exactly on the fingerprint", async () => {
  const narration = { mentor: { en: "Stored.", bn: "সংরক্ষিত।" } };

  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom("3.10", "3.65", "2.80"),
      fc.constantFrom("6.5", "7.5", "5.5"),
      fc.constantFrom(0, 3, 12),
      async (cgpa, band, bookmarkCount) => {
        const double = install({
          profile: scoredProfile({ cgpa, ielts_score: band }),
          bookmarkCount,
        });

        const first = await get();
        expect(first.body.narration_status).toBe("pending");

        // Land a narration against the fingerprint the read just stored.
        const stored = double.roadmapRow()!;
        const cached = install({
          profile: scoredProfile({ cgpa, ielts_score: band }),
          bookmarkCount,
          roadmap: { ...stored, narration, narration_status: "ready" },
        });

        // (a) an unchanged profile is a cache hit: same status, same narration
        const hit = await get();
        expect(hit.body.narration_status).toBe("ready");
        expect(hit.body.mentor).toEqual(narration.mentor);
        expect(cached.roadmapRow()!.narration).toEqual(narration);
        expect(cached.roadmapRow()!.profile_fingerprint).toBe(stored.profile_fingerprint);

        // (b) a mutation that moves an input clears it
        cached.setProfile({ cgpa: "3.95" });
        const miss = await get();
        expect(cached.roadmapRow()!.profile_fingerprint).not.toBe(stored.profile_fingerprint);
        expect(miss.body.narration_status).toBe("pending");
        expect(cached.roadmapRow()!.narration).toBeNull();

        // (c) a readiness change carries the prior value and the version behind it
        if (miss.body.readiness !== hit.body.readiness) {
          expect(miss.body.previous_readiness).toBe(hit.body.readiness);
          expect(miss.body.previous_engine_version).toBe(hit.body.engine_version);
        }
      },
    ),
    { numRuns: 27 },
  );
});

// ── Property 23 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 23: For any set of stored progress rows and for any
// pair of target countries, switching from A to B and back to A returns the same
// milestone statuses as before the switch, an ENGINE_VERSION bump rejoins by key
// with the same result, repeated roadmap reads issue no write to the progress
// table, and keys absent from the current path are excluded from the response
// while remaining in the table.
test("progress survives every regeneration and every path change", async () => {
  const statusesOf = (body: RoadmapResponse) =>
    Object.fromEntries(body.milestones.map((milestone) => [milestone.key, milestone.status]));

  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom("Germany", "Canada", "USA", "United Kingdom", "Japan"),
      fc.constantFrom("Canada", "Japan", "Bhutan", "United Kingdom"),
      fc.uniqueArray(
        fc.constantFrom(
          "passport",
          "cv",
          "sop",
          "lor",
          "aps_germany",
          "pal_canada",
          "coe_japan",
          "retired_key_from_v0",
        ),
        { maxLength: 5 },
      ),
      async (countryA, countryB, storedKeys) => {
        const progress = storedKeys.map((key) => ({
          milestone_key: key,
          status: "done" as const,
          manual_override: true,
        }));
        const double = install({ profile: scoredProfile({ target_country: countryA }), progress });

        const before = await get();
        const rowsBefore = double.progressRows();

        // A second read changes nothing in the progress table.
        await get();
        expect(double.progressRows()).toEqual(rowsBefore);
        expect(double.writes.every((write) => /INSERT INTO roadmaps/.test(write.text))).toBe(true);

        // Switch away…
        double.setProfile({ target_country: countryB });
        const away = await get();
        // …and back.
        double.setProfile({ target_country: countryA });
        const back = await get();

        expect(statusesOf(back.body)).toEqual(statusesOf(before.body));
        expect(double.progressRows()).toEqual(rowsBefore);

        // Keys outside whichever path is current are excluded from the response
        // and retained in the table.
        const awayKeys = away.body.milestones.map((milestone) => milestone.key);
        for (const key of storedKeys) {
          if (!awayKeys.includes(key)) {
            expect(double.progressRow(key)).not.toBeNull();
          }
        }
      },
    ),
    { numRuns: 40 },
  );
});

// ── Property 25 ──────────────────────────────────────────────────────────────

// Feature: roadmap, Property 25: For any request body reaching the roadmap read,
// generate or milestone route without a valid session, the response is 401 and no
// database statement is issued; and for any authenticated request, every statement
// the route emits binds the authenticated user id and no other user id appears in
// any parameter.
//
// The generate route arrives with task 4; the two routes that exist are both
// covered here, and the milestone route's own 401 case is asserted again beside
// its other rejections.
test("every roadmap statement is authenticated and scoped", async () => {
  const { PATCH } = await import("../milestones/[key]/route");
  const patchRequest = (body: unknown) => ({ json: async () => body }) as never;

  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom("user_alice", "user_bob", "user_ভালো"),
      fc.constantFrom("passport", "cv", "sop"),
      fc.constantFrom("todo", "in_progress", "done", "skipped"),
      async (userId, key, status) => {
        // (a) no session → 401, nothing issued
        state.userId = null;
        const unauthenticated = install({ profile: scoredProfile() });
        expect((await GET()).status).toBe(401);
        expect(
          (await PATCH(patchRequest({ status }), { params: Promise.resolve({ key }) })).status,
        ).toBe(401);
        expect(unauthenticated.reads).toHaveLength(0);
        expect(unauthenticated.writes).toHaveLength(0);

        // (b) a session → every statement binds that user and no other
        state.userId = userId;
        const double = createRoadmapDbDouble({ userId, profile: scoredProfile({ id: userId }) });
        state.db = double;

        await GET();
        await PATCH(patchRequest({ status }), { params: Promise.resolve({ key }) });

        const others = ["user_alice", "user_bob", "user_ভালো", "user_test"].filter(
          (candidate) => candidate !== userId,
        );
        for (const read of double.reads) {
          // The published-guide lookup is global by design; it binds no values,
          // so it can carry nothing across tenants.
          if (/FROM guides/.test(read.text)) {
            expect(read.values).toEqual([]);
            continue;
          }
          expect(read.values).toContain(userId);
          for (const other of others) expect(read.values).not.toContain(other);
        }
        for (const write of double.writes) {
          expect(write.params).toContain(userId);
          for (const other of others) expect(write.params).not.toContain(other);
        }
      },
    ),
    { numRuns: 30 },
  );
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTaggedSqlDouble, type CapturedTagged } from "@/test-support/sql-double";

/**
 * The web app serves real traffic and 0.2.3 is in closed testing, so the three
 * read surfaces that already exist must come out of this release byte-identical
 * in shape. These are the frozen snapshots and the "did anyone touch
 * PROFILE_FIELDS?" alarm.
 *
 * Two of the assertions read route files as text rather than importing them.
 * That is deliberate: `PROFILE_FIELDS` and the match route's sparseness gate are
 * module-private, and the point is to notice an edit to them, which text catches
 * and a behavioural test would not.
 */

const state = vi.hoisted(() => ({
  userId: "user_test" as string | null,
  respond: null as null | ((query: CapturedTagged) => Record<string, unknown>[]),
  embeddingQueries: [] as string[],
}));

vi.mock("@/utils/db", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings
      .reduce((acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""), "")
      .replace(/\s+/g, " ")
      .trim();
    if (!state.respond) throw new Error("sql double not installed");
    return Promise.resolve(state.respond({ text, values }));
  },
  sqlQuery: () => {
    throw new Error("no read surface should use sqlQuery");
  },
}));

vi.mock("@/utils/api-auth", () => ({
  getUser: async () => (state.userId ? { userId: state.userId } : null),
  requireAdmin: async () => null,
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: async () => null,
  auth: async () => ({ userId: state.userId }),
}));

vi.mock("@/lib/nim", () => ({
  generateEmbedding: async (query: string) => {
    state.embeddingQueries.push(query);
    return [0.1, 0.2, 0.3];
  },
}));

const { GET: getProfile } = await import("../profile/route");
const { GET: getDashboard } = await import("../dashboard/route");
const { GET: getMatch } = await import("../profile/match/route");

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** A profile with nine of the fourteen dashboard fields filled. */
const BASE_PROFILE: Record<string, unknown> = {
  id: "user_test",
  full_name: "Nusrat Jahan",
  email: "nusrat@example.com",
  cgpa: 3.65,
  target_degree: "masters",
  preferred_countries: "Germany, Canada",
  bsc_major: "CSE",
  university: "BUET",
  graduation_year: 2023,
  ielts_score: "7.5",
  work_experience: "2 years at Brac",
  research_interests: "NLP for Bangla",
  goals_notes: null,
  gre_gmat_score: null,
  internships: null,
  published_papers: null,
  portfolio_url: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

/** The eight columns Migration 026 adds — invisible to every surface below. */
const ROADMAP_COLUMNS = [
  "target_country",
  "target_intake_term",
  "target_intake_year",
  "english_test_type",
  "english_test_status",
  "english_test_date",
  "docs",
  "roadmap_onboarded_at",
] as const;

function installReads(profile: Record<string, unknown> | null) {
  state.respond = ({ text }) => {
    if (/FROM profiles WHERE id/.test(text)) return profile ? [profile] : [];
    if (/FROM user_bookmarks/.test(text)) return [];
    if (/FROM chat_sessions/.test(text)) return [];
    if (/FROM chat_messages/.test(text)) return [];
    if (/COUNT\(\*\)::int AS cnt FROM scholarships/.test(text)) return [{ cnt: 0 }];
    if (/match_scholarship_docs/.test(text)) return [];
    if (/^INSERT INTO profiles/.test(text)) return [];
    throw new Error(`unexpected read: ${text}`);
  };
}

async function body(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

beforeEach(() => {
  state.userId = "user_test";
  state.respond = null;
  state.embeddingQueries = [];
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.OPENROUTER_API_KEY = "test-key";
});

// ── PROFILE_FIELDS stays at fourteen ─────────────────────────────────────────

describe("api/dashboard/route.ts — PROFILE_FIELDS", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../dashboard/route.ts", import.meta.url)),
    "utf8",
  );

  test("PROFILE_FIELDS holds exactly 14 entries", () => {
    const block = /const PROFILE_FIELDS[\s\S]*?\n\];/.exec(source);
    expect(block).not.toBeNull();
    const keys = [...block![0].matchAll(/\{\s*key:\s*"(\w+)"/g)].map((m) => m[1]);
    expect(keys).toHaveLength(14);
    // Adding the roadmap columns here would drop every live web user's readiness
    // from 8/14 to 8/22 with no change on their side.
    for (const column of ROADMAP_COLUMNS) expect(keys).not.toContain(column);
  });
});

// ── The match route's sparseness gate is untouched ────────────────────────────

describe("api/profile/match/route.ts — sparseness gate", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../profile/match/route.ts", import.meta.url)),
    "utf8",
  );

  test("the gate still reads exactly target_degree, preferred_countries and cgpa", () => {
    const gate = /if \(!profile\.[\s\S]*?\) \{/.exec(source);
    expect(gate).not.toBeNull();
    const fields = [...gate![0].matchAll(/profile\.(\w+)/g)].map((m) => m[1]);
    expect(fields).toEqual(["target_degree", "preferred_countries", "cgpa"]);
  });

  test("the route exports GET only", () => {
    expect(source).toMatch(/export async function GET\(/);
    expect([...source.matchAll(/export async function (\w+)\(/g)].map((m) => m[1])).toEqual(["GET"]);
  });
});

// ── Frozen response-key snapshots ────────────────────────────────────────────

describe("frozen response keys", () => {
  test("GET /api/profile returns { profile } and the full row", async () => {
    installReads(BASE_PROFILE);
    const res = await getProfile();
    expect(res.status).toBe(200);
    const payload = await body(res);
    expect(Object.keys(payload)).toEqual(["profile"]);
    expect(payload.profile).toEqual(BASE_PROFILE);
  });

  test("GET /api/dashboard keys are unchanged", async () => {
    installReads(BASE_PROFILE);
    const res = await getDashboard();
    expect(res.status).toBe(200);
    const payload = await body(res);
    expect(Object.keys(payload)).toEqual([
      "user",
      "stats",
      "bookmarks",
      "bookmarksClosingSoon",
      "lastSession",
    ]);
    expect(Object.keys(payload.user as object)).toEqual(["name", "email"]);
    expect(Object.keys(payload.stats as object)).toEqual([
      "readiness",
      "bookmarksCount",
      "missingFields",
      "newScholarshipsCount",
    ]);
  });

  test("GET /api/profile/match returns { matches }", async () => {
    installReads(BASE_PROFILE);
    const res = await getMatch();
    expect(res.status).toBe(200);
    const payload = await body(res);
    expect(Object.keys(payload)).toEqual(["matches"]);
  });

  test("readiness for the base profile is 9 of 14", async () => {
    installReads(BASE_PROFILE);
    const payload = await body(await getDashboard());
    const stats = payload.stats as { readiness: number; missingFields: string[] };
    expect(stats.readiness).toBe(Math.round((9 / 14) * 100));
    expect(stats.missingFields).toHaveLength(5);
  });
});

// ── Property 4 ───────────────────────────────────────────────────────────────

/** Arbitrary values for the eight roadmap columns, including absent. */
const arbRoadmapColumns = fc.record(
  {
    target_country: fc.oneof(fc.constant(null), fc.string({ maxLength: 40 })),
    target_intake_term: fc.constantFrom(null, "spring", "summer", "fall", "winter"),
    target_intake_year: fc.oneof(fc.constant(null), fc.integer({ min: 2025, max: 2035 })),
    english_test_type: fc.constantFrom(null, "ielts", "toefl", "duolingo", "pte", "moi", "waiver"),
    english_test_status: fc.constantFrom(null, "not_started", "preparing", "booked", "scored"),
    english_test_date: fc.oneof(fc.constant(null), fc.constant("2026-09-01")),
    docs: fc.oneof(
      fc.constant(null),
      fc.dictionary(fc.constantFrom("passport", "cv", "sop"), fc.constantFrom("ready", "missing"), {
        maxKeys: 3,
      }),
    ),
    roadmap_onboarded_at: fc.oneof(fc.constant(null), fc.constant("2026-02-01T00:00:00.000Z")),
  },
  { requiredKeys: [] },
);

// Feature: roadmap, Property 4: For any profile, arbitrarily mutating only the
// eight columns added by Migration 026 changes neither the Dashboard_Route
// readiness value nor the Match_Route embedding query text.
test("the roadmap columns are invisible to the live surfaces", async () => {
  installReads(BASE_PROFILE);
  const baselineDashboard = (await body(await getDashboard())).stats;
  state.embeddingQueries = [];
  await getMatch();
  const baselineQueries = [...state.embeddingQueries];

  await fc.assert(
    fc.asyncProperty(arbRoadmapColumns, async (roadmapColumns) => {
      installReads({ ...BASE_PROFILE, ...roadmapColumns });

      const stats = (await body(await getDashboard())).stats;
      expect(stats).toEqual(baselineDashboard);

      state.embeddingQueries = [];
      await getMatch();
      expect(state.embeddingQueries).toEqual(baselineQueries);
    }),
    { numRuns: 100 },
  );
});

// ── The tagged double itself ──────────────────────────────────────────────────

describe("test-support/sql-double", () => {
  test("interpolates values as positional parameters", async () => {
    const double = createTaggedSqlDouble(() => []);
    await double.sql`SELECT * FROM profiles WHERE id = ${"user_1"} LIMIT 1`;
    expect(double.calls[0]).toEqual({
      text: "SELECT * FROM profiles WHERE id = $1 LIMIT 1",
      values: ["user_1"],
    });
  });
});

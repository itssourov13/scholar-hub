import fc from "fast-check";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { NextRequest } from "next/server";
import {
  assignedColumnsOf,
  createSqlQueryDouble,
  setClauseOf,
  type SqlQueryDouble,
} from "@/test-support/sql-double";

/**
 * `PUT /api/profile` is the only live surface the roadmap work touches, so it is
 * the only place a bug in this release can reach a shipped client's data. Every
 * assertion here runs against a `sqlQuery` double that captures `(text, params)`
 * — no database, no network.
 */

const state = vi.hoisted(() => ({
  userId: "user_test" as string | null,
  sqlQuery: null as null | ((text: string, params?: unknown[]) => Promise<unknown[]>),
}));

vi.mock("@/utils/db", () => ({
  sql: () => {
    throw new Error("PUT /api/profile must not use the tagged template");
  },
  sqlQuery: (text: string, params?: unknown[]) => {
    if (!state.sqlQuery) throw new Error("sqlQuery double not installed");
    return state.sqlQuery(text, params);
  },
}));

vi.mock("@/utils/api-auth", () => ({
  getUser: async () => (state.userId ? { userId: state.userId } : null),
}));

const { PUT } = await import("../route");

/** The eight columns Migration 026 adds. A 0.2.3 client has never heard of them. */
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

/** Exactly the keys Shipped_Client 0.2.3 sends on every profile save. */
const SHIPPED_CLIENT_KEYS = [
  "full_name",
  "cgpa",
  "work_experience",
  "target_degree",
  "preferred_countries",
  "goals_notes",
  "bsc_major",
  "university",
  "graduation_year",
  "research_interests",
  "published_papers",
  "ielts_score",
  "gre_gmat_score",
  "internships",
  "portfolio_url",
] as const;

/** Mirrors the route's WRITABLE allow-list. Kept here on purpose: if the route
 *  gains or loses a writable column, this list has to move with it. */
const WRITABLE_KEYS = [...SHIPPED_CLIENT_KEYS, ...ROADMAP_COLUMNS] as const;

const SEEDED_ROADMAP_VALUES: Record<string, unknown> = {
  target_country: "germany",
  target_intake_term: "fall",
  target_intake_year: 2026,
  english_test_type: "ielts",
  english_test_status: "preparing",
  english_test_date: "2026-03-12",
  docs: { passport: "ready", lor_count: 2 },
  roadmap_onboarded_at: "2026-01-04T09:00:00.000Z",
};

function shippedClientBody(): Record<string, unknown> {
  return {
    full_name: "Nusrat Jahan",
    cgpa: "3.65",
    work_experience: "2 years at Brac",
    target_degree: "masters",
    preferred_countries: "Germany, Canada",
    goals_notes: "Fully funded MSc in CS",
    bsc_major: "CSE",
    university: "BUET",
    graduation_year: "2023",
    research_interests: "NLP for Bangla",
    published_papers: "1 conference paper",
    ielts_score: "7.5",
    gre_gmat_score: "",
    internships: "Therap intern",
    portfolio_url: "https://example.com/nusrat",
  };
}

function install(seed: Record<string, unknown> = {}): SqlQueryDouble {
  const double = createSqlQueryDouble(seed);
  state.sqlQuery = (text, params) => double.sqlQuery(text, params);
  return double;
}

function putRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

async function put(body: unknown) {
  const res = await PUT(putRequest(body));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** How a column's new value reaches Postgres: a bound parameter, or a literal. */
function boundValueFor(
  text: string,
  params: unknown[],
  column: string,
): { kind: "param"; value: unknown } | { kind: "literal"; expression: string } | null {
  const clause = setClauseOf(text);
  const match = new RegExp(`(?:^|, )${column} = ([^,]+?)(?=, |$)`).exec(clause);
  if (!match) return null;
  const expression = match[1].trim();
  const positional = /^\$(\d+)$/.exec(expression);
  if (positional) return { kind: "param", value: params[Number(positional[1]) - 1] };
  return { kind: "literal", expression };
}

beforeEach(() => {
  state.userId = "user_test";
  state.sqlQuery = null;
});

// ── The two mandatory regression tests (task 1.6) ────────────────────────────

describe("PUT /api/profile — mandatory regressions", () => {
  test("version skew: a 0.2.3 body never touches the eight roadmap columns", async () => {
    const double = install({ id: "user_test", ...SEEDED_ROADMAP_VALUES });

    const res = await put(shippedClientBody());

    expect(res.status).toBe(200);
    const { text } = double.lastCall();
    const assigned = assignedColumnsOf(text);

    for (const column of ROADMAP_COLUMNS) {
      expect(assigned).not.toContain(column);
      expect(setClauseOf(text)).not.toContain(column);
    }
    // …and the stored values survived the save.
    for (const [column, value] of Object.entries(SEEDED_ROADMAP_VALUES)) {
      expect(double.row()[column]).toEqual(value);
    }
    const profile = res.body.profile as Record<string, unknown>;
    expect(profile.target_country).toBe("germany");
    expect(profile.docs).toEqual({ passport: "ready", lor_count: 2 });
    // The response shape is unchanged: `{ profile }` and nothing else.
    expect(Object.keys(res.body)).toEqual(["profile"]);
  });

  test("explicit clearing still clears: PUT { cgpa: null }", async () => {
    const double = install({ id: "user_test", cgpa: 3.65 });

    const res = await put({ cgpa: null });

    expect(res.status).toBe(200);
    const { text, params } = double.lastCall();
    expect(text).toContain("SET cgpa = $1, updated_at = NOW()");
    expect(params[0]).toBeNull();
    expect(assignedColumnsOf(text)).toEqual(["cgpa", "updated_at"]);
    expect(double.row().cgpa).toBeNull();
  });
});

// ── Legacy data must not brick saving ────────────────────────────────────────
//
// Both live clients read the whole row and post the whole row back, and the
// 0.2.3 handler stored whatever `parseFloat`/`parseInt` produced. So values
// outside the ranges a validator would like are already in production. A 400 for
// one of them would fail *every* subsequent save for that student, not just the
// field they got wrong — so the 15 pre-existing columns coerce and never reject.

describe("PUT /api/profile — pre-existing out-of-range values keep saving", () => {
  test("a profile whose stored cgpa is 85 (typed as a percentage) still saves the full 15-key payload", async () => {
    // Exactly the production state: GET returned cgpa 85, the form round-trips it
    // as a string, the PUT carries all fifteen keys.
    const double = install({ id: "user_test", cgpa: 85, ...SEEDED_ROADMAP_VALUES });

    const res = await put({ ...shippedClientBody(), cgpa: "85", full_name: "Edited Name" });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
    expect(double.row().cgpa).toBe(85);
    expect(double.row().full_name).toBe("Edited Name");
  });

  test("a profile whose stored graduation_year is 2040 still saves the full 15-key payload", async () => {
    const double = install({ id: "user_test", graduation_year: 2040, ...SEEDED_ROADMAP_VALUES });

    const res = await put({
      ...shippedClientBody(),
      graduation_year: "2040",
      full_name: "Edited Name",
    });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
    expect(double.row().graduation_year).toBe(2040);
    expect(double.row().full_name).toBe("Edited Name");
  });

  test("out-of-range cgpa and graduation_year are written, not rejected", async () => {
    for (const [column, sent, stored] of [
      ["cgpa", 85, 85],
      ["cgpa", "-1", -1],
      ["cgpa", 9.9, 9.9],
      ["graduation_year", 2040, 2040],
      ["graduation_year", "1899", 1899],
    ] as const) {
      const double = install({ id: "user_test" });
      const res = await put({ [column]: sent });
      expect(res.status).toBe(200);
      expect(double.row()[column]).toBe(stored);
    }
  });

  test('cgpa: "abc" stores NULL rather than NaN', async () => {
    const double = install({ id: "user_test", cgpa: 3.65 });

    const res = await put({ cgpa: "abc" });

    expect(res.status).toBe(200);
    const { params } = double.lastCall();
    expect(params[0]).toBeNull();
    expect(Number.isNaN(params[0])).toBe(false);
    expect(double.row().cgpa).toBeNull();
  });

  test('graduation_year: "next year" stores NULL rather than NaN', async () => {
    const double = install({ id: "user_test", graduation_year: 2023 });

    const res = await put({ graduation_year: "next year" });

    expect(res.status).toBe(200);
    expect(double.lastCall().params[0]).toBeNull();
    expect(double.row().graduation_year).toBeNull();
  });
});

// ── Edge cases the design names explicitly ───────────────────────────────────

describe("PUT /api/profile — edge cases", () => {
  test("an empty body is 400 and writes nothing", async () => {
    const double = install({ id: "user_test" });
    const res = await put({});
    expect(res.status).toBe(400);
    expect(double.calls).toHaveLength(0);
  });

  test("a body of unknown keys only is 400 and writes nothing", async () => {
    const double = install({ id: "user_test" });
    const res = await put({ role: "admin", id: "someone_else", nope: 1 });
    expect(res.status).toBe(400);
    expect(double.calls).toHaveLength(0);
  });

  // A roadmap column: no row holds a value yet, so strictness costs nobody a
  // save and Req 1.8 mandates it.
  test("target_intake_year outside 2025-2035 is 400 and writes nothing", async () => {
    const double = install({ id: "user_test" });
    const res = await put({ target_intake_year: 2050, full_name: "Should not be written" });
    expect(res.status).toBe(400);
    expect(double.calls).toHaveLength(0);
  });

  test("an unauthenticated request is 401 and writes nothing", async () => {
    const double = install({ id: "user_test" });
    state.userId = null;
    const res = await put({ cgpa: 3.2 });
    expect(res.status).toBe(401);
    expect(double.calls).toHaveLength(0);
  });

  test("docs merges at the key level and an explicit null removes one key", async () => {
    const double = install({
      id: "user_test",
      docs: { passport: "ready", sop: "in_progress", lor_count: 2 },
    });

    const res = await put({ docs: { sop: "ready", transcripts: "in_progress", lor_count: null } });

    expect(res.status).toBe(200);
    expect(double.row().docs).toEqual({
      passport: "ready",
      sop: "ready",
      transcripts: "in_progress",
    });
  });

  test("unknown doc keys and out-of-domain values are dropped, not rejected", async () => {
    const double = install({ id: "user_test", docs: { passport: "ready" } });

    const res = await put({
      docs: { sop: "ready", from_a_newer_client: "ready", transcripts: "eventually", lor_count: 99 },
    });

    expect(res.status).toBe(200);
    expect(double.row().docs).toEqual({ passport: "ready", sop: "ready" });
  });

  test("docs: null clears the column outright", async () => {
    const double = install({ id: "user_test", docs: { passport: "ready" } });
    const res = await put({ docs: null });
    expect(res.status).toBe(200);
    expect(setClauseOf(double.lastCall().text)).toContain("docs = NULL");
    expect(double.row().docs).toBeNull();
  });

  test("a missing profile row is 404", async () => {
    state.sqlQuery = async () => [];
    const res = await put({ cgpa: 3.2 });
    expect(res.status).toBe(404);
  });
});

// ── Generators ───────────────────────────────────────────────────────────────

/** Values that must never draw a 400, per writable key. For the eight roadmap
 *  columns that means in-domain values only — they validate. For the fifteen
 *  pre-existing columns it means anything a client can put in the box: they
 *  carry no validators, so out-of-range and unparseable values belong here
 *  rather than on a rejection path. */
const VALID_VALUES: Record<(typeof WRITABLE_KEYS)[number], fc.Arbitrary<unknown>> = {
  full_name: fc.oneof(fc.constant(null), fc.constant(""), fc.string({ maxLength: 200 })),
  cgpa: fc.oneof(
    fc.constant(null),
    fc.constant(""),
    fc.integer({ min: 0, max: 500 }).map((n) => n / 100),
    fc.integer({ min: 0, max: 500 }).map((n) => String(n / 100)),
    // Already-stored shapes: a percentage, a negative, prose.
    fc.constantFrom(85, "85", -1, 12.5, "abc", "N/A"),
  ),
  work_experience: fc.oneof(fc.constant(null), fc.string({ maxLength: 800 })),
  target_degree: fc.constantFrom(null, "", "masters", "PhD", "Bachelor"),
  preferred_countries: fc.oneof(fc.constant(null), fc.string({ maxLength: 300 })),
  goals_notes: fc.oneof(fc.constant(null), fc.string({ maxLength: 200 })),
  bsc_major: fc.oneof(fc.constant(null), fc.string({ maxLength: 200 })),
  university: fc.oneof(fc.constant(null), fc.string({ maxLength: 200 })),
  graduation_year: fc.oneof(
    fc.constant(null),
    fc.constant(""),
    fc.integer({ min: 1950, max: 2035 }),
    fc.integer({ min: 1950, max: 2035 }).map(String),
    fc.constantFrom(1899, 2040, "2040", "next year"),
  ),
  research_interests: fc.oneof(fc.constant(null), fc.string({ maxLength: 200 })),
  published_papers: fc.oneof(fc.constant(null), fc.string({ maxLength: 200 })),
  ielts_score: fc.oneof(fc.constant(null), fc.string({ maxLength: 40 })),
  gre_gmat_score: fc.oneof(fc.constant(null), fc.string({ maxLength: 40 })),
  internships: fc.oneof(fc.constant(null), fc.string({ maxLength: 200 })),
  portfolio_url: fc.oneof(fc.constant(null), fc.string({ maxLength: 200 })),
  target_country: fc.oneof(fc.constant(null), fc.string({ maxLength: 80 })),
  target_intake_term: fc.constantFrom(null, "", "spring", "summer", "fall", "winter", "Fall"),
  target_intake_year: fc.oneof(
    fc.constant(null),
    fc.constant(""),
    fc.integer({ min: 2025, max: 2035 }),
    fc.integer({ min: 2025, max: 2035 }).map(String),
  ),
  english_test_type: fc.constantFrom(null, "", "ielts", "toefl", "duolingo", "pte", "moi", "waiver"),
  english_test_status: fc.constantFrom(
    null,
    "",
    "not_started",
    "preparing",
    "booked",
    "taken",
    "scored",
    "waived",
  ),
  english_test_date: fc.oneof(fc.constant(null), fc.constant(""), fc.constant("2026-09-01")),
  docs: fc.oneof(
    fc.constant(null),
    fc.dictionary(
      fc.constantFrom("passport", "cv", "sop", "transcripts", "lor_count", "unknown_key"),
      fc.oneof(
        fc.constantFrom("missing", "in_progress", "ready", "eventually"),
        fc.integer({ min: -5, max: 99 }),
        fc.constant(null),
      ),
      { maxKeys: 5 },
    ),
  ),
  roadmap_onboarded_at: fc.oneof(fc.constant(null), fc.constant(true), fc.constant("2026-02-01T00:00:00.000Z")),
};

/** A body holding a random subset of the writable keys, all values valid. */
const arbWritableBody = (options: { minKeys?: number } = {}) =>
  fc
    .subarray([...WRITABLE_KEYS], { minLength: options.minKeys ?? 0 })
    .chain((keys) =>
      fc
        .tuple(...keys.map((key) => VALID_VALUES[key]))
        .map((values) => Object.fromEntries(keys.map((key, i) => [key, values[i]]))),
    );

/** The writable columns whose coercion is trim-and-truncate only, so a bound
 *  parameter can be compared to the value that was sent verbatim. */
const TEXT_COLUMNS = [
  "full_name",
  "work_experience",
  "preferred_countries",
  "goals_notes",
  "bsc_major",
  "university",
  "research_interests",
  "published_papers",
  "ielts_score",
  "gre_gmat_score",
  "internships",
  "portfolio_url",
  "target_country",
] as const;

/** Strings a hostile client would send as a *value*. */
const arbHostileValue = fc.constantFrom(
  "'; DROP TABLE profiles; --",
  "1) OR 1=1 --",
  "updated_at=NOW(),role='admin'",
  "$1, role = 'admin'",
  "docs = NULL",
  "\\'; SELECT * FROM profiles; --",
);

// ── Property 1 ───────────────────────────────────────────────────────────────

// Feature: roadmap, Property 1: For any stored profile and for any subset of the
// writable-column allow-list present in a PUT body, every column outside that
// subset holds the same value after the request as before it.
test("partial update touches only the keys it was given", async () => {
  await fc.assert(
    fc.asyncProperty(arbWritableBody({ minKeys: 1 }), async (body) => {
      const seed: Record<string, unknown> = {
        id: "user_test",
        ...SEEDED_ROADMAP_VALUES,
        cgpa: 3.5,
        full_name: "Seeded Name",
        graduation_year: 2020,
        ielts_score: "7.0",
      };
      const double = install(seed);

      const res = await put(body);
      expect(res.status).toBe(200);

      const touched = new Set(assignedColumnsOf(double.lastCall().text));
      for (const [column, value] of Object.entries(seed)) {
        if (touched.has(column)) continue;
        expect(double.row()[column]).toEqual(value);
      }
    }),
    { numRuns: 100 },
  );
});

// ── Property 2 ───────────────────────────────────────────────────────────────

// Feature: roadmap, Property 2: For any writable column and for any clearing
// value (null or ""), the emitted statement binds null for that column; and for
// any request body, including bodies containing SQL fragments as values, the
// emitted query text contains no substring of any body value and every value is
// bound as a positional parameter.
test("clearing values clear, and only through parameters", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(...WRITABLE_KEYS),
      fc.constantFrom(null, ""),
      fc.dictionary(fc.constantFrom(...TEXT_COLUMNS), arbHostileValue, { maxKeys: 4 }),
      async (column, clearing, hostile) => {
        // (a) clearing clears. `docs` is the one column with two clearing
        // shapes: an explicit null drops the column, while "" is an empty patch
        // and must leave the stored map alone rather than wiping it.
        const clearer = install({ id: "user_test", docs: { passport: "ready" } });
        const cleared = await put({ [column]: clearing });
        expect(cleared.status).toBe(200);
        if (column === "docs") {
          if (clearing === null) {
            expect(setClauseOf(clearer.lastCall().text)).toContain("docs = NULL");
            expect(clearer.row().docs).toBeNull();
          } else {
            expect(clearer.row().docs).toEqual({ passport: "ready" });
          }
        } else {
          const bound = boundValueFor(clearer.lastCall().text, clearer.lastCall().params, column);
          expect(bound).not.toBeNull();
          if (bound?.kind === "param") expect(bound.value).toBeNull();
          else expect(bound?.expression).toBe("NULL");
        }

        // (b) values never reach the statement text, only the parameter list
        const hostileKeys = Object.keys(hostile).sort(
          (a, b) =>
            (WRITABLE_KEYS as readonly string[]).indexOf(a) -
            (WRITABLE_KEYS as readonly string[]).indexOf(b),
        );
        if (hostileKeys.length === 0) return;

        const injected = install({ id: "user_test" });
        const res = await put(hostile);
        expect(res.status).toBe(200);
        const { text, params } = injected.lastCall();

        for (const value of Object.values(hostile)) {
          expect(text).not.toContain(value);
          expect(params).toContain(value);
        }
        // The statement text is a function of the key set alone: every value
        // travels as a positional parameter, so no fragment can reach the SQL.
        expect(text).toBe(
          `UPDATE profiles SET ${hostileKeys
            .map((key, i) => `${key} = $${i + 1}`)
            .join(", ")}, updated_at = NOW()
     WHERE id = $${hostileKeys.length + 1}
     RETURNING *`,
        );
      },
    ),
    { numRuns: 100 },
  );
});

// ── Property 3 ───────────────────────────────────────────────────────────────

// Feature: roadmap, Property 3: For any request body, keys absent from the
// writable-column allow-list never appear in the SET clause and the response is
// 200 whenever at least one writable key is present; for any docs object, every
// stored entry has an allow-listed key and a value inside that key's declared
// domain; and for any target_intake_year outside 2025-2035 the response is 400
// with no statement issued.
test("the allow-lists are the schema", async () => {
  const DOC_STATUS_KEYS = [
    "passport",
    "cv",
    "sop",
    "transcripts",
    "funding_proof",
    "lor",
    "aps",
    "blocked_account",
    "proof_of_funds",
    "pal",
    "i20",
    "ds160",
    "cas",
    "ihs",
    "professor_contact",
    "coe",
  ];
  const DOC_STATUSES = ["missing", "in_progress", "ready"];

  await fc.assert(
    fc.asyncProperty(
      arbWritableBody({ minKeys: 1 }),
      fc.dictionary(fc.string({ maxLength: 12 }), fc.string({ maxLength: 12 }), { maxKeys: 4 }),
      fc.oneof(
        fc.integer({ min: -3000, max: 2024 }),
        fc.integer({ min: 2036, max: 9999 }),
        fc.constant(2025.5),
        fc.constant("not a year"),
      ),
      async (writable, junk, badYear) => {
        // (a) unknown keys never reach the SET clause; a writable key still saves
        const unknownOnly = Object.fromEntries(
          Object.entries(junk).filter(([key]) => !(WRITABLE_KEYS as readonly string[]).includes(key)),
        );
        const double = install({ id: "user_test" });
        const res = await put({ ...unknownOnly, ...writable });
        expect(res.status).toBe(200);
        const assigned = assignedColumnsOf(double.lastCall().text);
        for (const key of Object.keys(unknownOnly)) expect(assigned).not.toContain(key);
        for (const column of assigned) {
          expect([...WRITABLE_KEYS, "updated_at"]).toContain(column);
        }

        // (b) every stored doc entry is allow-listed and in-domain
        const docs = double.row().docs as Record<string, unknown> | null | undefined;
        if (docs && typeof docs === "object") {
          for (const [key, value] of Object.entries(docs)) {
            expect([...DOC_STATUS_KEYS, "lor_count"]).toContain(key);
            if (key === "lor_count") {
              expect(Number.isInteger(value)).toBe(true);
              expect(value as number).toBeGreaterThanOrEqual(0);
              expect(value as number).toBeLessThanOrEqual(5);
            } else {
              expect(DOC_STATUSES).toContain(value);
            }
          }
        }

        // (c) an out-of-range intake year is 400 with nothing written
        const rejecting = install({ id: "user_test" });
        const rejected = await put({ ...writable, target_intake_year: badYear });
        expect(rejected.status).toBe(400);
        expect(rejecting.calls).toHaveLength(0);
      },
    ),
    { numRuns: 100 },
  );
});

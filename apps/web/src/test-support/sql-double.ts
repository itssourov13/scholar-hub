/**
 * Test doubles for `@/utils/db`.
 *
 * `createSqlQueryDouble` stands in for `sqlQuery(text, params)`: it captures
 * every `(text, params)` pair and applies the statement's SET clause to an
 * in-memory row, which is what lets a test assert both "the SET clause never
 * mentioned this column" and "the column still holds its seeded value" from one
 * request. It understands exactly the three assignment shapes the profile route
 * emits — `col = $n`, `docs = NULL` and the JSONB merge-minus-keys expression —
 * and nothing else, deliberately: it is a reader for our own generated SQL, not
 * a Postgres.
 *
 * `createTaggedSqlDouble` stands in for the neon tagged template, so a route
 * that reads with `sql\`...\`` can be invoked without a database.
 *
 * Nothing here is imported by application code.
 */

export type CapturedQuery = { text: string; params: unknown[] };
export type CapturedTagged = { text: string; values: unknown[] };

/** The text between `SET` and `WHERE`, whitespace-normalised. */
export function setClauseOf(text: string): string {
  const match = /\bSET\b([\s\S]*?)\bWHERE\b/.exec(text);
  if (!match) return "";
  return match[1].replace(/\s+/g, " ").trim().replace(/,$/, "");
}

/** Split a comma-separated SQL list without cutting inside parentheses. */
function splitTopLevel(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** The column names assigned by a statement's SET clause, in emitted order. */
export function assignedColumnsOf(text: string): string[] {
  return splitTopLevel(setClauseOf(text))
    .map((assignment) => assignment.split("=")[0].trim())
    .filter(Boolean);
}

function applySetClause(
  row: Record<string, unknown>,
  text: string,
  params: unknown[],
): Record<string, unknown> {
  const next = { ...row };
  for (const assignment of splitTopLevel(setClauseOf(text))) {
    const eq = assignment.indexOf("=");
    if (eq === -1) continue;
    const column = assignment.slice(0, eq).trim();
    const expression = assignment.slice(eq + 1).trim();

    if (/^NOW\(\)$/i.test(expression)) continue; // updated_at
    if (/^NULL$/i.test(expression)) {
      next[column] = null;
      continue;
    }

    const positional = /^\$(\d+)$/.exec(expression);
    if (positional) {
      next[column] = params[Number(positional[1]) - 1];
      continue;
    }

    // docs = (COALESCE(docs, '{}'::jsonb) || $n::jsonb) - $m::text[]
    const jsonbMerge = /\$(\d+)::jsonb\)\s*-\s*\$(\d+)::text\[\]$/.exec(expression);
    if (jsonbMerge) {
      const merge = JSON.parse(String(params[Number(jsonbMerge[1]) - 1])) as Record<string, unknown>;
      const remove = (params[Number(jsonbMerge[2]) - 1] ?? []) as string[];
      const base = (next[column] ?? {}) as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...base, ...merge };
      for (const key of remove) delete merged[key];
      next[column] = merged;
      continue;
    }

    throw new Error(`sql-double: unrecognised assignment "${assignment}"`);
  }
  return next;
}

export type SqlQueryDouble = {
  /** Drop-in for `sqlQuery` from `@/utils/db`. */
  sqlQuery: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
  /** Every statement issued, in order. Empty when the route wrote nothing. */
  calls: CapturedQuery[];
  /** The last statement issued. Throws when there was none. */
  lastCall: () => CapturedQuery;
  /** The stored row as it stands after the statements applied so far. */
  row: () => Record<string, unknown>;
};

export function createSqlQueryDouble(seed: Record<string, unknown> = {}): SqlQueryDouble {
  const calls: CapturedQuery[] = [];
  let row: Record<string, unknown> = { ...seed };

  return {
    calls,
    async sqlQuery<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
      calls.push({ text, params });
      row = applySetClause(row, text, params);
      return [row as T];
    },
    lastCall() {
      const last = calls[calls.length - 1];
      if (!last) throw new Error("sql-double: no statement was issued");
      return last;
    },
    row() {
      return row;
    },
  };
}

export type TaggedSqlDouble = {
  /** Drop-in for the neon `sql` tagged template. */
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;
  calls: CapturedTagged[];
};

/**
 * `respond` receives the interpolated statement text (values replaced by `$n`)
 * and the bound values, and returns the rows that read should produce.
 */
export function createTaggedSqlDouble(
  respond: (query: CapturedTagged) => Record<string, unknown>[],
): TaggedSqlDouble {
  const calls: CapturedTagged[] = [];
  return {
    calls,
    async sql(strings: TemplateStringsArray, ...values: unknown[]) {
      const text = strings.reduce(
        (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""),
        "",
      );
      const query: CapturedTagged = { text: text.replace(/\s+/g, " ").trim(), values };
      calls.push(query);
      return respond(query);
    },
  };
}

// ── The roadmap routes (task 3) ──────────────────────────────────────────────
//
// `GET /api/roadmap` and `PATCH /api/roadmap/milestones/[key]` issue statement
// shapes the profile double cannot read: four tagged-template reads, and two
// upserts whose whole behaviour lives in `ON CONFLICT DO UPDATE` and a CTE. So
// this double emulates exactly those two statements — the `previous_readiness`
// and narration `CASE` clauses, and the `prior` CTE's pre-write `celebrated_at` —
// and throws on anything else. Same stance as above: a reader for our own
// generated SQL, not a Postgres.

export type ProgressRecord = {
  user_id: string;
  milestone_key: string;
  status: string;
  progress: number | null;
  manual_override: boolean;
  completed_at: string | null;
  celebrated_at: string | null;
};

export type RoadmapRecord = Record<string, unknown>;

export type RoadmapDbSeed = {
  userId?: string;
  /** `null` models a student with no `profiles` row at all. */
  profile?: Record<string, unknown> | null;
  bookmarkCount?: number;
  cvCount?: number;
  progress?: (Partial<ProgressRecord> & { milestone_key: string })[];
  roadmap?: RoadmapRecord | null;
  /** Slugs `guides` reports as published. Defaults to none, which is what
   *  production looks like today: every catalog slug is still unwritten. */
  publishedGuides?: string[];
};

export type RoadmapDbDouble = {
  /** Drop-in for the neon tagged template: the four user-scoped reads. */
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;
  /** Drop-in for `sqlQuery`: the two upserts. */
  sqlQuery: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
  /** Every read, in order. */
  reads: CapturedTagged[];
  /** Every write, in order. */
  writes: CapturedQuery[];
  progressRows: () => ProgressRecord[];
  progressRow: (key: string) => ProgressRecord | null;
  roadmapRow: () => RoadmapRecord | null;
  setProfile: (patch: Record<string, unknown>) => void;
  setSignals: (patch: { bookmarkCount?: number; cvCount?: number }) => void;
};

const PROGRESS_PROJECTION = [
  "milestone_key",
  "status",
  "progress",
  "manual_override",
  "completed_at",
  "celebrated_at",
] as const;

export function createRoadmapDbDouble(seed: RoadmapDbSeed = {}): RoadmapDbDouble {
  const userId = seed.userId ?? "user_test";
  let profile: Record<string, unknown> | null =
    seed.profile === undefined ? { id: userId } : seed.profile;
  let bookmarkCount = seed.bookmarkCount ?? 0;
  let cvCount = seed.cvCount ?? 0;
  let roadmap: RoadmapRecord | null = seed.roadmap ?? null;
  const publishedGuides = seed.publishedGuides ?? [];

  const progress = new Map<string, ProgressRecord>();
  for (const row of seed.progress ?? []) {
    progress.set(row.milestone_key, {
      user_id: userId,
      status: "todo",
      progress: null,
      manual_override: false,
      completed_at: null,
      celebrated_at: null,
      ...row,
    });
  }

  const reads: CapturedTagged[] = [];
  const writes: CapturedQuery[] = [];

  // A stand-in for NOW(): monotonic, so "was this written before that?" is
  // answerable without a real clock.
  let tick = 0;
  const now = () => {
    tick += 1;
    return `2026-01-15T00:00:${String(tick).padStart(2, "0")}.000Z`;
  };

  function read(query: CapturedTagged): Record<string, unknown>[] {
    if (/FROM profiles/i.test(query.text)) return profile ? [{ ...profile }] : [];
    if (/FROM user_bookmarks/i.test(query.text)) return [{ cnt: bookmarkCount }];
    if (/FROM user_cvs/i.test(query.text)) return [{ cnt: cvCount }];
    if (/FROM milestone_progress/i.test(query.text)) {
      return [...progress.values()].map((row) =>
        Object.fromEntries(PROGRESS_PROJECTION.map((column) => [column, row[column]])),
      );
    }
    if (/FROM guides/i.test(query.text)) return publishedGuides.map((slug) => ({ slug }));
    throw new Error(`sql-double: unrecognised read "${query.text}"`);
  }

  /** The `roadmaps` upsert, including both `CASE` clauses. Parameter order
   *  matches `persistRoadmap`. */
  function upsertRoadmap(params: unknown[]): RoadmapRecord[] {
    const [
      , // user_id
      engineVersion,
      fingerprint,
      readiness,
      confidence,
      feasibility,
      countrySource,
      scoreBreakdown,
      strengths,
      weaknesses,
      milestones,
      nextAction,
    ] = params;

    const incoming: RoadmapRecord = {
      user_id: userId,
      engine_version: engineVersion,
      profile_fingerprint: fingerprint,
      readiness: readiness ?? null,
      confidence,
      feasibility,
      country_source: countrySource,
      score_breakdown: JSON.parse(String(scoreBreakdown)),
      strengths: JSON.parse(String(strengths)),
      weaknesses: JSON.parse(String(weaknesses)),
      milestones: JSON.parse(String(milestones)),
      next_action: nextAction === null ? null : JSON.parse(String(nextAction)),
      updated_at: now(),
    };

    if (!roadmap) {
      roadmap = {
        ...incoming,
        previous_readiness: null,
        previous_engine_version: null,
        narration: null,
        narration_status: "pending",
        created_at: incoming.updated_at,
      };
      return [{ ...roadmap }];
    }

    const readinessMoved = roadmap.readiness !== incoming.readiness;
    const sameFingerprint = roadmap.profile_fingerprint === incoming.profile_fingerprint;
    roadmap = {
      ...roadmap,
      ...incoming,
      previous_readiness: readinessMoved ? roadmap.readiness : roadmap.previous_readiness,
      previous_engine_version: readinessMoved
        ? roadmap.engine_version
        : roadmap.previous_engine_version,
      narration_status: sameFingerprint ? roadmap.narration_status : "pending",
      narration: sameFingerprint ? roadmap.narration : null,
    };
    return [{ ...roadmap }];
  }

  /** The `milestone_progress` CTE, including `first_celebration` read from the
   *  pre-write snapshot. */
  function upsertProgress(params: unknown[]): Record<string, unknown>[] {
    const [, key, status, progressParam] = params as [string, string, string, number | null];
    const prior = progress.get(key) ?? null;
    const priorCelebratedAt = prior?.celebrated_at ?? null;
    const stamp = now();

    const next: ProgressRecord = prior
      ? {
          ...prior,
          status,
          progress: progressParam ?? prior.progress,
          manual_override: true,
          completed_at: status === "done" ? (prior.completed_at ?? stamp) : null,
          celebrated_at: status === "done" ? (prior.celebrated_at ?? stamp) : prior.celebrated_at,
        }
      : {
          user_id: userId,
          milestone_key: key,
          status,
          progress: progressParam ?? null,
          manual_override: true,
          completed_at: status === "done" ? stamp : null,
          celebrated_at: status === "done" ? stamp : null,
        };

    progress.set(key, next);
    return [{ ...next, first_celebration: status === "done" && priorCelebratedAt === null }];
  }

  return {
    reads,
    writes,
    async sql(strings: TemplateStringsArray, ...values: unknown[]) {
      const text = strings.reduce(
        (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""),
        "",
      );
      const query: CapturedTagged = { text: text.replace(/\s+/g, " ").trim(), values };
      reads.push(query);
      return read(query);
    },
    async sqlQuery<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
      writes.push({ text, params });
      if (/INSERT INTO roadmaps/i.test(text)) return upsertRoadmap(params) as T[];
      if (/INSERT INTO milestone_progress/i.test(text)) return upsertProgress(params) as T[];
      throw new Error(`sql-double: unrecognised write "${text.slice(0, 60)}…"`);
    },
    progressRows() {
      return [...progress.values()].map((row) => ({ ...row }));
    },
    progressRow(key: string) {
      const row = progress.get(key);
      return row ? { ...row } : null;
    },
    roadmapRow() {
      return roadmap ? { ...roadmap } : null;
    },
    setProfile(patch: Record<string, unknown>) {
      profile = { ...(profile ?? { id: userId }), ...patch };
    },
    setSignals(patch: { bookmarkCount?: number; cvCount?: number }) {
      if (patch.bookmarkCount !== undefined) bookmarkCount = patch.bookmarkCount;
      if (patch.cvCount !== undefined) cvCount = patch.cvCount;
    },
  };
}

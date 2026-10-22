import { NextRequest, NextResponse } from "next/server";
import { sql, sqlQuery } from "@/utils/db";
import { getUser } from "@/utils/api-auth";

export async function GET() {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`SELECT * FROM profiles WHERE id = ${auth.userId} LIMIT 1`;
  if (!rows[0]) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({ profile: rows[0] });
}

// ── PUT is a partial update ───────────────────────────────────────────────────
//
// The handler this replaced destructured fifteen names and assigned *every*
// column with `?? null`, which is safe only while every client sends every
// column. It stops being safe the moment a column exists that a shipped client
// has never heard of: a 0.2.3 save would clear target_country, the intake pair,
// the three english_test_* columns and docs on every profile edit.
//
// So: only keys actually present in the body reach the SET clause. Column names
// come from WRITABLE (never from the request), values are always positional
// parameters, which is the whole SQL-injection argument. A tagged template can't
// express a variable SET list, so this uses sqlQuery — the documented escape
// hatch in utils/db.ts.

type Coerced = string | number | null;

type ColumnSpec = {
  /** Raw JSON value → the value bound as a positional parameter. */
  coerce: (v: unknown) => Coerced;
  /** Non-null return = reject the whole request with 400 and this message. */
  validate?: (v: unknown) => string | null;
};

/** Absent, null and "" all mean "clear this column". */
function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

const text = (max: number): ColumnSpec => ({
  coerce: (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s.slice(0, max);
  },
});

/**
 * A pre-existing numeric column: coerced, never rejected. See the note above
 * WRITABLE for why these carry no `validate`.
 *
 * `parseFloat`/`parseInt` return `NaN` for prose ("abc", "N/A", "will retake"),
 * and a `NaN` parameter is not a number Postgres will take for a NUMERIC or
 * INTEGER column — it would turn a save the 0.2.3 handler completed into a 500.
 * Unparseable therefore stores NULL, which is what the old handler effectively
 * did with `cgpa ? parseFloat(...) : null`.
 */
const legacyNumber = (parse: (raw: string) => number): ColumnSpec => ({
  coerce: (v) => {
    if (isBlank(v)) return null;
    const n = parse(String(v));
    return Number.isFinite(n) ? n : null;
  },
});

const intIn = (min: number, max: number, label: string): ColumnSpec => ({
  coerce: (v) => (isBlank(v) ? null : parseInt(String(v), 10)),
  validate: (v) => {
    if (isBlank(v)) return null; // clearing is always allowed
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max
      ? null
      : `${label} must be an integer between ${min} and ${max}`;
  },
});

const oneOf = (allowed: readonly string[], label: string): ColumnSpec => ({
  coerce: (v) => (isBlank(v) ? null : String(v).toLowerCase()),
  validate: (v) =>
    isBlank(v) || allowed.includes(String(v).toLowerCase())
      ? null
      : `${label} must be one of: ${allowed.join(", ")}`,
});

/** The allow-list IS the schema. Iteration order here fixes the SET clause
 *  order, which makes the generated SQL deterministic and therefore testable.
 *
 *  Validation strictness follows whether a column already holds legacy data,
 *  not whether validation is possible:
 *
 *  * The 15 columns that existed as of 0.2.3 are **permissive** — they coerce
 *    and never return 400 for a value reason. Both live clients read the whole
 *    row and post the whole row back (`apps/web/src/app/profile/page.tsx` does
 *    GET then `PUT JSON.stringify(profile)`; mobile 0.2.3 sends all 15 keys),
 *    and the handler this replaced wrote whatever `parseFloat`/`parseInt`
 *    produced. So out-of-range values are already stored in production — a CGPA
 *    entered as a percentage (`85`) is the common one. Rejecting the request
 *    over such a value would make *every* future save fail for that student and
 *    lock them out of editing anything until they noticed the one bad field.
 *    Bad old data is cheaper than an unusable profile screen.
 *  * The 8 columns Migration 026 adds are **strict** — no row holds a value
 *    yet, so there is no legacy data to protect and a 400 only ever rejects
 *    input a client just made up (Req 1.8 requires it for `target_intake_year`).
 *
 *  So: adding `validate` to one of the 15 is a regression, not a hardening. New
 *  columns get validators; the old ones get coercion. */
const WRITABLE: Record<string, ColumnSpec> = {
  // ── the 15 keys Shipped_Client 0.2.3 sends — permissive, no validators ──
  full_name: text(120),
  cgpa: legacyNumber((raw) => parseFloat(raw)),
  work_experience: text(500),
  target_degree: {
    coerce: (v) => (isBlank(v) ? null : String(v).trim().toLowerCase().slice(0, 40)),
  },
  preferred_countries: text(200),
  goals_notes: text(4000),
  bsc_major: text(120),
  university: text(160),
  graduation_year: legacyNumber((raw) => parseInt(raw, 10)),
  research_interests: text(1000),
  published_papers: text(500),
  ielts_score: text(32),
  gre_gmat_score: text(32),
  internships: text(500),
  portfolio_url: text(512),
  // ── the 8 roadmap columns (Migration 026) — strict, no legacy data at risk ──
  target_country: text(64),
  target_intake_term: oneOf(["spring", "summer", "fall", "winter"], "target_intake_term"),
  target_intake_year: intIn(2025, 2035, "target_intake_year"),
  english_test_type: oneOf(["ielts", "toefl", "duolingo", "pte", "moi", "waiver"], "english_test_type"),
  english_test_status: oneOf(
    ["not_started", "preparing", "booked", "taken", "scored", "waived"],
    "english_test_status",
  ),
  english_test_date: {
    coerce: (v) => (isBlank(v) ? null : String(v).slice(0, 10)),
    validate: (v) =>
      isBlank(v) || /^\d{4}-\d{2}-\d{2}$/.test(String(v))
        ? null
        : "english_test_date must be YYYY-MM-DD",
  },
  roadmap_onboarded_at: {
    coerce: (v) => (v === true ? new Date().toISOString() : v ? String(v) : null),
  },
  // `docs` is handled separately — it merges rather than replaces.
};

const DOC_STATUSES = ["missing", "in_progress", "ready"] as const;

/** key → value domain. "status" ∈ DOC_STATUSES; "count" ∈ integer 0-5. */
const DOC_KEYS = {
  passport: "status",
  cv: "status",
  sop: "status",
  transcripts: "status",
  funding_proof: "status",
  lor: "status",
  lor_count: "count",
  // country-specific, written by wizard step 3 and the milestone screens
  aps: "status",
  blocked_account: "status", // Germany
  proof_of_funds: "status",
  pal: "status", // Canada
  i20: "status",
  ds160: "status", // USA
  cas: "status",
  ihs: "status", // UK
  professor_contact: "status",
  coe: "status", // Japan
} as const;

/** Unknown keys and out-of-domain values are dropped, not rejected: a newer
 *  client sending a doc key this deploy doesn't know yet must still save the
 *  keys it does know. An explicit null removes that one key. */
function splitDocsPatch(raw: unknown): { merge: Record<string, unknown>; remove: string[] } {
  const merge: Record<string, unknown> = {};
  const remove: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { merge, remove };
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const domain = DOC_KEYS[key as keyof typeof DOC_KEYS];
    if (!domain) continue;
    if (value === null || value === "") {
      remove.push(key);
      continue;
    }
    if (domain === "status" && DOC_STATUSES.includes(String(value) as (typeof DOC_STATUSES)[number])) {
      merge[key] = String(value);
    }
    if (domain === "count") {
      const n = Number(value);
      if (Number.isInteger(n) && n >= 0 && n <= 5) merge[key] = n;
    }
  }
  return { merge, remove };
}

export async function PUT(req: NextRequest) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [column, spec] of Object.entries(WRITABLE)) {
    if (!(column in body)) continue; // absent → untouched
    const message = spec.validate?.(body[column]);
    if (message) return NextResponse.json({ error: message }, { status: 400 });
    params.push(spec.coerce(body[column])); // null / "" → NULL
    sets.push(`${column} = $${params.length}`);
  }

  // docs merges at the key level, so a client that sends { docs: { sop: "ready" } }
  // cannot wipe the passport status a different screen wrote. Same version-skew
  // protection as the SET clause above, one level deeper.
  if ("docs" in body) {
    const docs = body.docs;
    if (docs === null) {
      sets.push(`docs = NULL`);
    } else {
      const { merge, remove } = splitDocsPatch(docs); // allow-listed
      params.push(JSON.stringify(merge));
      const mergeParam = params.length;
      params.push(remove);
      const removeParam = params.length;
      sets.push(
        `docs = (COALESCE(docs, '{}'::jsonb) || $${mergeParam}::jsonb) - $${removeParam}::text[]`,
      );
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No writable fields in request body" }, { status: 400 });
  }

  params.push(auth.userId);
  const rows = await sqlQuery<Record<string, unknown>>(
    `UPDATE profiles SET ${sets.join(", ")}, updated_at = NOW()
     WHERE id = $${params.length}
     RETURNING *`,
    params,
  );

  if (!rows[0]) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  return NextResponse.json({ profile: rows[0] });
}

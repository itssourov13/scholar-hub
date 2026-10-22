import { NextRequest, NextResponse } from "next/server";
import type { MilestonePatchResponse } from "@scholarhub/shared";
import { getUser } from "@/utils/api-auth";
import { sqlQuery } from "@/utils/db";
import { buildRoadmap, unlockedBetween, type ProgressRow } from "@/lib/roadmap/graph";
import type { MilestoneStatus } from "@/lib/roadmap/types";
import { readRoadmapInputs } from "../../wire";

/**
 * `PATCH /api/roadmap/milestones/[key]` — a status write, and nothing else.
 *
 * The rule this route exists to enforce: **recording a status is not doing the
 * work.** It advances the path, unlocks what depends on it and fires the
 * completion feedback once — and it moves the score by zero, because the scorer
 * reads stored profile values and artefacts and never reads this table. `delta`
 * is computed as a difference rather than hardcoded, so the invariant is
 * observable in the response instead of merely believed.
 *
 * `manual_override` is always `true`: a student who touched a status has said
 * something the engine's auto-satisfaction must stop arguing with.
 */

export const dynamic = "force-dynamic";

const STATUSES: readonly MilestoneStatus[] = ["todo", "in_progress", "done", "skipped"];

type PatchBody = { status?: unknown; progress?: unknown };

const isBlank = (value: unknown) => value === null || value === undefined || value === "";

/**
 * The status a progress-only write implies.
 *
 * The shared client can send `{ progress }` alone — "two of the three letters are
 * in" — and the upsert always writes a status, so one has to be derived. Reaching
 * the target count reads as done, anything above zero as in progress, and zero as
 * back to todo.
 */
function statusFromProgress(progress: number, targetCount: number): MilestoneStatus {
  if (progress >= targetCount) return "done";
  return progress > 0 ? "in_progress" : "todo";
}

type UpsertRow = ProgressRow & { first_celebration: boolean };

/**
 * The `prior` CTE is load-bearing.
 *
 * A plain `RETURNING` on the upsert reports the post-update row, where
 * `celebrated_at` has already been set — so `celebrated_at IS NULL` would be
 * false even on a first completion, and the bloom would never play. Every CTE in
 * one statement shares a snapshot, so `prior` reads the value as it stood before
 * the write, which is exactly the "has this been celebrated yet?" bit.
 */
async function writeStatus(
  userId: string,
  key: string,
  status: MilestoneStatus,
  progress: number | null,
): Promise<UpsertRow | null> {
  const rows = await sqlQuery<UpsertRow>(
    `WITH prior AS (
       SELECT celebrated_at
       FROM milestone_progress
       WHERE user_id = $1 AND milestone_key = $2
     ),
     upsert AS (
       INSERT INTO milestone_progress (user_id, milestone_key, status, progress, manual_override,
                                       completed_at, celebrated_at, updated_at)
       VALUES ($1, $2, $3, $4, TRUE,
               CASE WHEN $3 = 'done' THEN NOW() ELSE NULL END,
               CASE WHEN $3 = 'done' THEN NOW() ELSE NULL END,
               NOW())
       ON CONFLICT (user_id, milestone_key) DO UPDATE SET
         status          = EXCLUDED.status,
         progress        = COALESCE(EXCLUDED.progress, milestone_progress.progress),
         manual_override = TRUE,
         completed_at    = CASE WHEN EXCLUDED.status = 'done'
                                THEN COALESCE(milestone_progress.completed_at, NOW())
                                ELSE NULL END,
         celebrated_at   = CASE WHEN EXCLUDED.status = 'done'
                                THEN COALESCE(milestone_progress.celebrated_at, NOW())
                                ELSE milestone_progress.celebrated_at END,
         updated_at      = NOW()
       RETURNING *
     )
     SELECT u.*,
            (u.status = 'done' AND (SELECT celebrated_at FROM prior) IS NULL) AS first_celebration
     FROM upsert u`,
    [userId, key, status, progress],
  );
  return rows[0] ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  const hasStatus = !isBlank(body.status);
  const hasProgress = !isBlank(body.progress);
  if (!hasStatus && !hasProgress) {
    return NextResponse.json({ error: "Send a status or a progress value" }, { status: 400 });
  }
  if (hasStatus && !STATUSES.includes(String(body.status) as MilestoneStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const read = await readRoadmapInputs(auth.userId);
  if (!read) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const now = Date.now();
  const before = buildRoadmap({ inputs: read.inputs, progress: read.progress, now });

  // A key outside the caller's own path is rejected before anything is written:
  // the roadmap is per-student, so "not in your path" and "does not exist" are the
  // same answer.
  const milestone = before.milestones.find((entry) => entry.key === key);
  if (!milestone) {
    return NextResponse.json({ error: "That step isn't in your roadmap" }, { status: 400 });
  }

  let progress: number | null = null;
  if (hasProgress) {
    const value = Number(body.progress);
    const targetCount = milestone.targetCount;
    if (!Number.isInteger(value) || targetCount === null || value < 0 || value > targetCount) {
      return NextResponse.json(
        {
          error:
            targetCount === null
              ? "That step doesn't track a count"
              : `progress must be an integer between 0 and ${targetCount}`,
        },
        { status: 400 },
      );
    }
    progress = value;
  }

  const status: MilestoneStatus = hasStatus
    ? (String(body.status) as MilestoneStatus)
    : statusFromProgress(progress!, milestone.targetCount!);

  const written = await writeStatus(auth.userId, key, status, progress);
  if (!written) {
    return NextResponse.json({ error: "Could not record that status" }, { status: 500 });
  }

  // Rebuild from the rows as they now stand. The scorer sees the same inputs it
  // saw a moment ago, which is why `delta` comes out 0 for every status write.
  const merged: ProgressRow[] = [
    ...read.progress.filter((row) => row.milestone_key !== key),
    {
      milestone_key: written.milestone_key,
      status: written.status,
      progress: written.progress,
      manual_override: written.manual_override,
      completed_at: written.completed_at,
      celebrated_at: written.celebrated_at,
    },
  ];
  const after = buildRoadmap({ inputs: read.inputs, progress: merged, now });
  const updated = after.milestones.find((entry) => entry.key === key)!;

  const delta =
    after.readiness !== null && before.readiness !== null ? after.readiness - before.readiness : 0;

  const payload: MilestonePatchResponse = {
    readiness: after.readiness,
    delta,
    // Set whenever the stored proof is still missing — the client renders it as
    // "add {evidence} to move your score" rather than promising a lift.
    evidence_label: updated.evidenceLabel,
    unlocked_keys: unlockedBetween(before, after),
    celebrate: written.first_celebration === true,
  };

  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

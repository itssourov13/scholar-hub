import { NextResponse } from "next/server";
import { getUser } from "@/utils/api-auth";
import { buildRoadmap } from "@/lib/roadmap/graph";
import { persistRoadmap, readRoadmapInputs, toWire } from "./wire";

/**
 * `GET /api/roadmap` — the deterministic read path.
 *
 * No AI call happens here, in any branch: the roadmap a student opens is
 * arithmetic over their own stored data, and narration arrives separately through
 * `POST /api/roadmap/generate`. The engine is pure, so this route owns everything
 * that is not — the session gate, four user-scoped reads, the clock, one upsert,
 * and the mapping to the wire shapes (`toWire`, in `./wire.ts`).
 *
 * The clock is read here and passed in. `buildRoadmap({ ..., now: Date.now() })`
 * is the only place a roadmap learns what day it is.
 *
 * Progress rows are read, never written. A milestone key absent from the current
 * path is filtered out of the response by the engine and left in the table, so
 * switching target country and back costs a student nothing.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const read = await readRoadmapInputs(auth.userId);
  // The dashboard's Clerk backfill creates the profile row on first visit; a
  // roadmap read is not the place to write one.
  if (!read) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const roadmap = buildRoadmap({
    inputs: read.inputs,
    progress: read.progress,
    now: Date.now(),
  });

  const row = await persistRoadmap(auth.userId, roadmap);

  const response = NextResponse.json(
    toWire(roadmap, row, {
      onboarded: read.inputs.onboardedAt !== null,
      publishedGuides: read.publishedGuides,
    }),
  );
  // A readiness score is per-student and moves on every write that feeds it.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

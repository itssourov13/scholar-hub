/**
 * The cache key.
 *
 * `roadmaps` is a cache with a key rather than a source of truth: everything on
 * the row except the narration and the previous-readiness pair is recomputable.
 * The fingerprint is what decides freshness — equal means serve the stored
 * narration, different means the inputs moved and the narration is stale.
 *
 * Two properties make that work. Key-sorting means insertion order is irrelevant,
 * so a route that builds `RoadmapInputs` field-by-field in a different order does
 * not invalidate every student's narration. Prefixing `ENGINE_VERSION` means a
 * bump invalidates all of them on purpose.
 *
 * `node:crypto` is computation, not I/O — this file reads nothing and calls
 * nothing over the network.
 */

import { createHash } from "node:crypto";

import { ENGINE_VERSION, type RoadmapInputs } from "./types";

/**
 * Recursive key-sorted JSON. Arrays keep their order — a list's order is data —
 * objects do not. `undefined` members are dropped, matching `JSON.stringify`, so
 * `{}` and `{ lor_count: undefined }` hash alike. Non-finite numbers serialise as
 * `null` for the same reason.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }
  // Functions and symbols cannot appear in RoadmapInputs; treat them as absent
  // rather than throwing, so a hostile row can never break a read.
  return "null";
}

/** sha256 hex over `${engineVersion}:${stableStringify(inputs)}`. Exported with
 *  the version as a parameter so the version's effect on the hash is testable
 *  without reaching for a module mock. */
export function fingerprintFor(engineVersion: number, inputs: RoadmapInputs): string {
  return createHash("sha256")
    .update(`${engineVersion}:${stableStringify(inputs)}`)
    .digest("hex");
}

export function fingerprint(inputs: RoadmapInputs): string {
  return fingerprintFor(ENGINE_VERSION, inputs);
}

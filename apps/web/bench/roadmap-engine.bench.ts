import { bench, describe } from "vitest";

import { buildRoadmap } from "../src/lib/roadmap/graph";
import { scoreProfile } from "../src/lib/roadmap/scoring";
import type { RoadmapInputs } from "../src/lib/roadmap/types";

/**
 * Construction time for a twelve-milestone path. **Reports, never gates.**
 *
 * `vitest run` does not collect this file — `benchmark.include` in
 * `vitest.config.mts` does, so it runs only under `pnpm bench`. That is
 * deliberate: a wall-clock assertion in CI is flaky on shared runners, and
 * Property 6 already proves the thing that actually matters about this engine,
 * which is that building a roadmap touches no network, no database and no clock.
 * A number a reviewer can read is worth more here than a threshold that fails on
 * a busy afternoon.
 */

const NOW = Date.UTC(2026, 0, 15, 3, 0, 0);

/** The generic path: the twelve country-independent milestones, nothing added. */
const twelveMilestones: RoadmapInputs = {
  degree: "master",
  cgpa: { value: 3.65, scale: 4 },
  english: { type: "ielts", band: 7, status: "scored", testDate: "2026-03-12" },
  research: { papers: 2 },
  experience: { workMonths: 30, internshipMonths: 6 },
  docs: { passport: "ready", transcripts: "ready", sop: "in_progress", lor_count: 2 },
  bookmarkCount: 6,
  hasCvRow: true,
  targetCountry: null,
  preferredCountries: [],
  intake: { term: "fall", year: 2027 },
  onboardedAt: "2026-01-04T09:00:00.000Z",
};

/** Germany: fourteen milestones, so the country additions are visible as a
 *  separate line rather than folded into the twelve. */
const withCountryRule: RoadmapInputs = { ...twelveMilestones, targetCountry: "Germany" };

const progress = [
  {
    milestone_key: "passport",
    status: "done" as const,
    progress: null,
    manual_override: true,
    completed_at: "2026-01-05T00:00:00.000Z",
    celebrated_at: "2026-01-05T00:00:00.000Z",
  },
];

describe("roadmap engine", () => {
  bench("buildRoadmap — 12 milestones, generic path", () => {
    buildRoadmap({ inputs: twelveMilestones, progress, now: NOW });
  });

  bench("buildRoadmap — 14 milestones, Germany", () => {
    buildRoadmap({ inputs: withCountryRule, progress, now: NOW });
  });

  // For scale: most of buildRoadmap's cost is the per-milestone projection, which
  // re-runs the scorer once per step.
  bench("scoreProfile — one pass", () => {
    scoreProfile(twelveMilestones);
  });
});

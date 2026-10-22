/**
 * Roadmap data access and the handful of presentation rules the screens share.
 *
 * The engine lives server-side, so there is nothing to compute here: the client
 * reads one response and renders it. The only logic that belongs on this side is
 * how a value maps to a colour, a label or a fill fraction — and the readiness
 * rule, which lives in `readinessView` so the journey header and the Home card
 * cannot word it differently.
 */

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  MilestoneNodeState,
  RoadmapMilestone,
  RoadmapResponse,
  MilestoneStatus,
} from "@scholarhub/shared";
import { useApi } from "./api";
import { useSignedInQuery } from "./query";
import { colors } from "@/theme";
import type { Lang } from "@/i18n";

export const ROADMAP_KEY = ["roadmap"] as const;

/** Below this the score is withheld — matches `CONFIDENCE_FLOOR` server-side. */
const CONFIDENCE_FLOOR = 40;

export function useRoadmap() {
  const api = useApi();
  return useSignedInQuery({ queryKey: ROADMAP_KEY, queryFn: () => api.getRoadmap() });
}

/** Marking a step done never moves the score by itself — the server returns the
 *  real delta, which is 0 unless the stored proof is already in place. */
export function useUpdateMilestone() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { key: string; status?: MilestoneStatus; progress?: number }) =>
      api.updateMilestone(vars.key, { status: vars.status, progress: vars.progress }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ROADMAP_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Stages ──────────────────────────────────────────────────────────────────

export const STAGE_ORDER = [
  "foundation",
  "testing",
  "documents",
  "applications",
  "visa",
] as const;

export type Stage = (typeof STAGE_ORDER)[number];

/**
 * The journey *is* the brand gradient. The Home readiness bar already runs
 * teal500 → coral400; these five pairs stretch that same progression down the
 * column, so the trail warms as the student climbs and consecutive stages meet
 * on a shared token with no seam at the boundary.
 */
export const STAGE_COLORS: Record<Stage, readonly [string, string]> = {
  foundation: [colors.teal800, colors.teal700],
  testing: [colors.teal700, colors.teal500],
  documents: [colors.teal500, colors.teal200],
  applications: [colors.coral400, colors.coral500],
  visa: [colors.coral500, colors.coral700],
};

export function stageOf(milestone: RoadmapMilestone): Stage {
  return (STAGE_ORDER as readonly string[]).includes(milestone.stage)
    ? (milestone.stage as Stage)
    : "foundation";
}

/** Milestones grouped into the stages actually present, in path order. */
export function groupByStage(
  milestones: readonly RoadmapMilestone[],
): { stage: Stage; items: RoadmapMilestone[]; done: number }[] {
  return STAGE_ORDER.map((stage) => {
    const items = milestones.filter((m) => stageOf(m) === stage);
    return { stage, items, done: items.filter((m) => m.state === "done").length };
  }).filter((group) => group.items.length > 0);
}

// ── Node presentation ───────────────────────────────────────────────────────

export type NodeLook = {
  bg: string;
  border: string | null;
  icon: "checkmark" | "ellipse" | "lock-closed" | "remove";
  iconColor: string;
  glow: boolean;
  dashed: boolean;
};

export function nodeLook(state: MilestoneNodeState): NodeLook {
  switch (state) {
    case "done":
      // Settled and quiet: a finished step should stop asking for attention.
      return {
        bg: colors.teal500,
        border: null,
        icon: "checkmark",
        iconColor: colors.white,
        glow: false,
        dashed: false,
      };
    case "active":
      // The only thing on the screen carrying a glow, so the eye lands here.
      return {
        bg: colors.surface,
        border: colors.coral500,
        icon: "ellipse",
        iconColor: colors.coral500,
        glow: true,
        dashed: false,
      };
    case "skipped":
      return {
        bg: colors.sand50,
        border: colors.sand300,
        icon: "remove",
        iconColor: colors.ink300,
        glow: false,
        dashed: true,
      };
    default:
      return {
        bg: colors.sand100,
        border: colors.sand300,
        icon: "lock-closed",
        iconColor: colors.ink300,
        glow: false,
        dashed: false,
      };
  }
}

/** How much of the connector below `index` is filled: solid between two done
 *  nodes, half below the last done one, empty after that. */
export function connectorFill(
  milestones: readonly RoadmapMilestone[],
  index: number,
): number {
  const here = milestones[index];
  const next = milestones[index + 1];
  if (!next) return 0;
  if (here.state === "done" && next.state === "done") return 1;
  if (here.state === "done") return 0.5;
  return 0;
}

// ── The readiness rule, in one place ────────────────────────────────────────

export type ReadinessView =
  | { kind: "score"; score: number; lift: { from: number; to: number } | null }
  | { kind: "unlock" }
  | { kind: "setup" };

/**
 * `readiness` is `null` until the server can stand behind a number — it needs
 * four of eight inputs known *and* both degree and CGPA. So a student who has
 * only answered the wizard sees a prompt for the unlocking field rather than a
 * demoralising 6%.
 */
export function readinessView(roadmap: RoadmapResponse): ReadinessView {
  if (roadmap.readiness === null) {
    return roadmap.confidence >= CONFIDENCE_FLOOR ? { kind: "unlock" } : { kind: "setup" };
  }
  const gain = roadmap.next_action?.projected_gain ?? 0;
  return {
    kind: "score",
    score: roadmap.readiness,
    lift: gain > 0 ? { from: roadmap.readiness, to: roadmap.readiness + gain } : null,
  };
}

export function pick(value: { en: string; bn: string }, lang: Lang): string {
  return lang === "bn" ? value.bn || value.en : value.en || value.bn;
}

/** `{a}` placeholders, filled. `useT()` returns a plain lookup, so the screens
 *  interpolate themselves rather than each doing its own `.replace` chain. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (out, [name, value]) => out.split(`{${name}}`).join(String(value)),
    template,
  );
}

/** The index of the node to bring into view on mount. */
export function activeIndex(milestones: readonly RoadmapMilestone[]): number {
  const found = milestones.findIndex((m) => m.state === "active");
  return found === -1 ? 0 : found;
}

export function useJourney() {
  const query = useRoadmap();
  const groups = useMemo(
    () => (query.data ? groupByStage(query.data.milestones) : []),
    [query.data],
  );
  return { ...query, groups };
}

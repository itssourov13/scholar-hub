/**
 * Multi-window rate limiter for the user-facing chat API.
 *
 * Each call to `checkChatRateLimit` evaluates several windows in order
 * (typically: per-hour, per-day, plus a global daily circuit breaker)
 * and returns the first window that fails. If all windows pass, the
 * counters for *every* window are incremented.
 *
 * Backed by Redis when REDIS_URL is set, with an in-memory fallback
 * for local dev — same pattern as the existing `checkRateLimit` helper.
 */

import { checkRateLimit } from "@/lib/nim";

export type ChatTier = "anonymous" | "user" | "admin";

export type ChatLimits = {
  hourly: number;
  daily: number;
  global: number;
};

type CheckOpts = {
  /** Stable identifier for this caller (user.id, anon_key, or IP). */
  callerId: string;
  /** Which tier of limits to apply. */
  tier: ChatTier;
  /** Optional override of the default limits map. */
  limits?: Partial<ChatLimits>;
  /** If true, only read counters — do not increment. Used by /quota endpoint. */
  inspectOnly?: boolean;
};

export type RateLimitDecision = {
  allowed: boolean;
  /** Which window blocked the request when `allowed=false`. */
  scope?: "hourly" | "daily" | "global";
  /** Milliseconds until the blocking window resets. */
  resetMs?: number;
  /** Remaining counts after this call (or current values if inspectOnly). */
  remaining: {
    hourly: number;
    daily: number;
    global: number;
  };
};

const DEFAULT_LIMITS: Record<ChatTier, ChatLimits> = {
  anonymous: { hourly: 3, daily: 3, global: 20000 },
  user: { hourly: 6, daily: 15, global: 20000 },
  admin: { hourly: 50, daily: 200, global: 20000 },
};

/**
 * Separate quota for photo/PDF turns (vision tokens). Kept independent of the
 * text chat windows so 15 text messages/day cannot become 15 Luna calls.
 * Hourly === daily for users so two screenshots can go in one sitting, but a
 * UTC-midnight reset cannot be used to send 4 in two minutes.
 */
export const CHAT_ATTACHMENT_LIMITS: Record<ChatTier, ChatLimits> = {
  anonymous: { hourly: 0, daily: 0, global: 300 },
  user: { hourly: 2, daily: 2, global: 300 },
  admin: { hourly: 8, daily: 20, global: 300 },
};

const ONE_HOUR_MS = 60 * 60_000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

const resolveLimits = (
  map: Record<ChatTier, ChatLimits>,
  tier: ChatTier,
  override?: Partial<ChatLimits>,
): ChatLimits => {
  const base = map[tier];
  return {
    hourly: override?.hourly ?? base.hourly,
    daily: override?.daily ?? base.daily,
    global: override?.global ?? base.global,
  };
};

const todayKey = () => {
  // UTC date so day-resets are consistent regardless of server tz.
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate(),
  ).padStart(2, "0")}`;
};

const inspectLimits = (limits: ChatLimits): RateLimitDecision => ({
  allowed: true,
  remaining: {
    hourly: limits.hourly,
    daily: limits.daily,
    global: limits.global,
  },
});

const evaluateWindows = async (
  limits: ChatLimits,
  keys: { hourly: string; daily: string; global: string },
): Promise<RateLimitDecision> => {
  // Increment+check global first so abuse spikes can be detected even
  // before per-user limits would have fired.
  const globalResult = await checkRateLimit(keys.global, {
    limit: limits.global,
    windowMs: ONE_DAY_MS,
  });

  const hourlyResult = await checkRateLimit(keys.hourly, {
    limit: limits.hourly,
    windowMs: ONE_HOUR_MS,
  });

  const dailyResult = await checkRateLimit(keys.daily, {
    limit: limits.daily,
    windowMs: ONE_DAY_MS,
  });

  const remaining = {
    hourly: hourlyResult.remaining,
    daily: dailyResult.remaining,
    global: globalResult.remaining,
  };

  if (!globalResult.allowed) {
    return { allowed: false, scope: "global", resetMs: globalResult.resetMs, remaining };
  }
  if (!dailyResult.allowed) {
    return { allowed: false, scope: "daily", resetMs: dailyResult.resetMs, remaining };
  }
  if (!hourlyResult.allowed) {
    return { allowed: false, scope: "hourly", resetMs: hourlyResult.resetMs, remaining };
  }
  return { allowed: true, remaining };
};

export const checkChatRateLimit = async (opts: CheckOpts): Promise<RateLimitDecision> => {
  const limits = resolveLimits(DEFAULT_LIMITS, opts.tier, opts.limits);
  // inspectOnly is used by /quota as a hint only — it must not consume quota.
  if (opts.inspectOnly) return inspectLimits(limits);

  const day = todayKey();
  return evaluateWindows(limits, {
    hourly: `chat:h:${opts.tier}:${opts.callerId}`,
    daily: `chat:d:${opts.tier}:${opts.callerId}:${day}`,
    global: `chat:g:${day}`,
  });
};

export const checkChatAttachmentRateLimit = async (opts: CheckOpts): Promise<RateLimitDecision> => {
  const limits = resolveLimits(CHAT_ATTACHMENT_LIMITS, opts.tier, opts.limits);
  if (opts.inspectOnly) return inspectLimits(limits);

  const day = todayKey();
  return evaluateWindows(limits, {
    hourly: `chat:att:h:${opts.tier}:${opts.callerId}`,
    daily: `chat:att:d:${opts.tier}:${opts.callerId}:${day}`,
    global: `chat:att:g:${day}`,
  });
};

export const formatResetWindow = (ms: number): string => {
  if (ms <= 0) return "moments";
  const totalSec = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (hours >= 1) {
    return `${hours}h ${mins}m`;
  }
  if (mins >= 1) {
    return `${mins}m`;
  }
  return `${totalSec}s`;
};

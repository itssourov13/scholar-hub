import { useCallback, useRef } from "react";
import { AppState, Linking } from "react-native";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as StoreReview from "expo-store-review";

/**
 * Rating prompts. Two entry points with deliberately different behaviour:
 *
 * - The native in-app review sheet appears on its own once the user has spent
 *   real time in any feature. Google's guidelines say it must arrive unannounced
 *   (no custom "do you like the app?" dialog first) and it may silently no-op
 *   when its own quota is hit, so it is never wired to a button.
 * - `openStoreListing` backs the explicit "Rate this app" menu row, where the
 *   user asked for it and must see something happen.
 *
 * Feature screens bank time with `useRateAppEngagement`; the sheet is fired from
 * `useRateAppPrompt`, which belongs on screens the user lands on *between* tasks
 * (home, profile) rather than inside a flow.
 */

const STORAGE_KEY = "bp_rate_prompt";

/** A screen visit shorter than this was a passing glance, not engagement. */
const MIN_VISIT_MS = 20_000;
/** Caps a single visit so time spent with the app backgrounded can't inflate it. */
const MAX_VISIT_MS = 5 * 60_000;

const VISITS_BEFORE_ASKING = 2;
const ENGAGED_MS_BEFORE_ASKING = 90_000;

/**
 * Play resolves `requestReview` successfully even when it decides to show
 * nothing, and tells us nothing either way. So an ask is retried a couple of
 * times, days apart, instead of spending the release's only chance on a sheet
 * that may never have appeared.
 */
const ASKS_PER_VERSION = 3;
const ASK_SPACING_MS = 3 * 24 * 60 * 60 * 1000;

/** Lets the screen transition finish before the sheet slides over it. */
const SETTLE_MS = 1_200;
/** Nothing may interrupt the opening moments of a launch. */
const MIN_UPTIME_MS = 30_000;

const LAUNCHED_AT = Date.now();

type RateState = {
  /** Qualifying screen visits across every feature. */
  visits: number;
  engagedMs: number;
  askedAt: number | null;
  askedVersion: string | null;
  /** Asks already spent on `askedVersion`. Resets when the version changes. */
  asksThisVersion: number;
};

const EMPTY: RateState = { visits: 0, engagedMs: 0, askedAt: null, askedVersion: null, asksThisVersion: 0 };

const appVersion = () => Constants.expoConfig?.version ?? "unknown";

async function readState(): Promise<RateState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<RateState>) };
  } catch {
    return EMPTY;
  }
}

async function writeState(state: RateState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A lost counter only costs us a prompt opportunity.
  }
}

async function bankVisit(ms: number): Promise<void> {
  if (ms < MIN_VISIT_MS) return;
  try {
    const state = await readState();
    await writeState({
      ...state,
      visits: state.visits + 1,
      engagedMs: state.engagedMs + Math.min(ms, MAX_VISIT_MS),
    });
  } catch {
    // Same as above — nothing user-facing depends on this.
  }
}

function asksSpent(state: RateState, version: string): number {
  return state.askedVersion === version ? state.asksThisVersion : 0;
}

function isEligible(state: RateState, version: string): boolean {
  if (state.visits < VISITS_BEFORE_ASKING) return false;
  if (state.engagedMs < ENGAGED_MS_BEFORE_ASKING) return false;
  if (asksSpent(state, version) >= ASKS_PER_VERSION) return false;
  if (state.askedAt !== null && Date.now() - state.askedAt < ASK_SPACING_MS) return false;
  return true;
}

async function askForReview(): Promise<void> {
  try {
    if (Date.now() - LAUNCHED_AT < MIN_UPTIME_MS) return;

    const state = await readState();
    const version = appVersion();
    if (!isEligible(state, version)) return;

    // The sheet must not be requested while we're heading to the background.
    if (AppState.currentState !== "active") return;
    if (!(await StoreReview.isAvailableAsync())) return;

    // Spend the ask and zero the counters, so the next one needs both renewed
    // engagement and the spacing gap.
    await writeState({
      visits: 0,
      engagedMs: 0,
      askedAt: Date.now(),
      askedVersion: version,
      asksThisVersion: asksSpent(state, version) + 1,
    });
    await StoreReview.requestReview();
  } catch {
    // Never let a rating prompt surface an error to the user.
  }
}

/**
 * Banks the time the user spends on this screen towards a future rating prompt.
 * Add it to any feature screen — mentor chat, scholarship detail, guides, the CV
 * tools — and it records how long the screen held focus. Records only; the sheet
 * is fired elsewhere.
 */
export function useRateAppEngagement(): void {
  const focusedAt = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      focusedAt.current = Date.now();
      return () => {
        const started = focusedAt.current;
        focusedAt.current = null;
        if (started !== null) void bankVisit(Date.now() - started);
      };
    }, []),
  );
}

/**
 * Shows the review sheet when the user lands on this screen with enough banked
 * engagement. Belongs on between-task screens only. A launch grace period keeps
 * the sheet from greeting a cold start.
 */
export function useRateAppPrompt(): void {
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => void askForReview(), SETTLE_MS);
      return () => clearTimeout(timer);
    }, []),
  );
}

/** Opens the store listing for the explicit "Rate this app" action. */
export async function openStoreListing(): Promise<boolean> {
  try {
    const url = StoreReview.storeUrl();
    if (!url) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Diagnostics for the hidden long-press on the "Rate this app" row. Play gives
 * no feedback about whether a sheet was shown, so this is the only way to tell a
 * gating problem on our side from Play choosing to stay silent.
 */
export async function rateDebugSummary(): Promise<string> {
  const state = await readState();
  const version = appVersion();
  let nativeAvailable = false;
  try {
    nativeAvailable = await StoreReview.isAvailableAsync();
  } catch {
    nativeAvailable = false;
  }
  const lastAsked = state.askedAt ? new Date(state.askedAt).toLocaleString() : "never";
  return [
    `Visits: ${state.visits} / ${VISITS_BEFORE_ASKING}`,
    `Engaged: ${Math.round(state.engagedMs / 1000)}s / ${ENGAGED_MS_BEFORE_ASKING / 1000}s`,
    `Asks used: ${asksSpent(state, version)} / ${ASKS_PER_VERSION} (v${version})`,
    `Last ask: ${lastAsked}`,
    `Play review API: ${nativeAvailable ? "available" : "unavailable"}`,
    `Eligible now: ${isEligible(state, version) ? "yes" : "no"}`,
  ].join("\n");
}

/**
 * Fires the sheet ignoring every gate. Diagnostic only — if this shows nothing,
 * the silence is Play's (quota, already reviewed, non-primary account) and not
 * our gating.
 */
export async function forceReviewSheet(): Promise<boolean> {
  try {
    if (!(await StoreReview.isAvailableAsync())) return false;
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}

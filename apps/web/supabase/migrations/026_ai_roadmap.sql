-- ============================================================
-- 026_ai_roadmap.sql
-- AI Personalized Roadmap (v1).
--
--   * profiles (+8 cols) — the roadmap's own inputs. All nullable, no
--                     DEFAULT, no NOT NULL: on PG 18 that makes each ADD
--                     COLUMN a catalogue-only change, so no table rewrite
--                     and no long ACCESS EXCLUSIVE hold on a live table.
--                     `docs` is JSONB rather than eight more columns because
--                     the required document set is country-dependent and
--                     still growing (APS, blocked account, GIC, PAL, CAS).
--                     Validated server-side against an allow-list.
--
--   * roadmaps    — one row per student, PK user_id. Holds the last
--                     deterministic snapshot plus the AI narration.
--                     `readiness` is NULLABLE on purpose: NULL means
--                     "not enough known to say", which is different from 0.
--                     `profile_fingerprint` is the cache key — a mismatch
--                     means the inputs moved and the narration is stale.
--
--   * milestone_progress — PK (user_id, milestone_key). Deliberately NOT
--                     inside roadmaps.milestones: regenerating a roadmap,
--                     or switching target country from Germany to Canada
--                     and back, must never cost a student progress.
--                     `celebrated_at` makes completion feedback fire once
--                     across devices.
--
-- Additive only. No DROP, no RENAME, no ALTER TYPE, no new constraint on
-- existing data. Rollback = revert the deploy and LEAVE THIS SCHEMA ALONE:
-- inert nullable columns and empty tables cost nothing.
--
-- All user FKs reference profiles.id (TEXT — Clerk user IDs).
-- ============================================================

BEGIN;

-- Fail fast rather than queueing behind (or in front of) live app queries.
-- SET LOCAL needs a transaction, which is also why the whole file is wrapped.
SET LOCAL lock_timeout      = '3s';
SET LOCAL statement_timeout = '30s';

-- ── profiles: roadmap inputs ────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_country       TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_intake_term   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_intake_year   INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS english_test_type    TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS english_test_status  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS english_test_date    DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS docs                 JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roadmap_onboarded_at TIMESTAMPTZ;

-- ── roadmaps ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roadmaps (
  user_id                 TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  engine_version          INTEGER     NOT NULL,
  profile_fingerprint     TEXT        NOT NULL,
  readiness               INTEGER,                 -- NULL = unestablished
  previous_readiness      INTEGER,
  previous_engine_version INTEGER,
  confidence              INTEGER     NOT NULL DEFAULT 0,
  feasibility             TEXT        NOT NULL DEFAULT 'on-track',
  country_source          TEXT        NOT NULL DEFAULT 'generic',
  score_breakdown         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  strengths               JSONB       NOT NULL DEFAULT '[]'::jsonb,
  weaknesses              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  milestones              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  next_action             JSONB,
  narration               JSONB,
  narration_status        TEXT        NOT NULL DEFAULT 'pending',
  model_used              TEXT,
  generated_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ops visibility only: "whose narration never landed?". Partial so it stays
-- tiny once narration succeeds for most rows.
CREATE INDEX IF NOT EXISTS idx_roadmaps_narration_unfinished
  ON public.roadmaps (updated_at DESC) WHERE narration_status <> 'ready';

-- ── milestone_progress ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.milestone_progress (
  user_id       TEXT        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  milestone_key TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'todo',
  progress      INTEGER,
  manual_override BOOLEAN   NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  celebrated_at TIMESTAMPTZ,
  notes         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, milestone_key)
);

COMMIT;

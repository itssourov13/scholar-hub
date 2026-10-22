-- ============================================================
-- 023_cv_builder.sql
-- CV Builder feature.
--
--   * user_cvs      — academic CVs students build in the app. The full
--                     CV content is stored as JSONB (`data`) so the shape
--                     can evolve without further migrations. `template`
--                     picks the visual layout.
--   * cv_analyses   — AI analysis runs on a CV the student uploaded. Kept
--                     so we can show the last result without re-running the
--                     (paid) model, and to encourage building a fresh CV.
--
-- All FKs reference profiles.id (TEXT — Clerk user IDs).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_cvs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled CV',
  template    TEXT NOT NULL DEFAULT 'classic',
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_cvs_user_id ON public.user_cvs (user_id);

CREATE TABLE IF NOT EXISTS public.cv_analyses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_name   TEXT,                    -- original uploaded file name
  overall_score INTEGER,                 -- 0–100 headline score
  result        JSONB NOT NULL,          -- full structured analysis
  model_used    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_analyses_user_id ON public.cv_analyses (user_id, created_at DESC);

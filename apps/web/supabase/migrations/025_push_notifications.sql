-- ============================================================
-- 025_push_notifications.sql
-- Server-driven push notifications over FCM HTTP v1.
--
--   * push_tokens          — one row per device registration. The FCM
--                            registration token is the PK because FCM can hand
--                            the same token to a re-installed app, and a device
--                            may change hands between accounts. `disabled_at`
--                            is set when FCM reports the token as gone
--                            (UNREGISTERED / NOT_FOUND) rather than deleting,
--                            so we keep a trail of churn.
--   * push_reminders_sent  — dedupe ledger for deadline reminders, so the daily
--                            job can run many times without re-notifying.
--
-- `push_sent_at` on scholarships/guides makes the "new content" push
-- exactly-once: the send is claimed with a conditional UPDATE, so repeated
-- admin PATCHes (or two concurrent requests) can't fan out twice.
--
-- All user FKs reference profiles.id (TEXT — Clerk user IDs).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
  token        TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL DEFAULT 'android',
  lang         TEXT NOT NULL DEFAULT 'en',
  app_version  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at  TIMESTAMPTZ
);

-- Fan-out reads every live token; deadline reminders read by user.
CREATE INDEX IF NOT EXISTS idx_push_tokens_active
  ON public.push_tokens (last_seen_at DESC) WHERE disabled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_push_tokens_user
  ON public.push_tokens (user_id) WHERE disabled_at IS NULL;

ALTER TABLE public.scholarships ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;
ALTER TABLE public.guides       ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

-- Everything already published predates push: mark it as sent so enabling the
-- feature doesn't blast the entire back catalogue on the first admin edit.
UPDATE public.scholarships SET push_sent_at = NOW() WHERE push_sent_at IS NULL;
UPDATE public.guides       SET push_sent_at = NOW() WHERE push_sent_at IS NULL;

CREATE TABLE IF NOT EXISTS public.push_reminders_sent (
  user_id        TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scholarship_id UUID NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  milestone      TEXT NOT NULL,  -- '7d' | '3d' | '1d'
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, scholarship_id, milestone)
);

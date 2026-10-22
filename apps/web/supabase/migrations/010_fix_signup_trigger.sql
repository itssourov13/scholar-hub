-- =============================================
-- BairePorbo Migration: 010_fix_signup_trigger
--
-- Problem: "Database error saving new user" on sign-up.
-- The handle_new_user trigger (from migration 007) tries to
-- INSERT default rows into user_tasks immediately after inserting
-- into profiles. If user_tasks doesn't exist yet, or if the
-- SECURITY DEFINER flag is missing (so it runs as the 'auth' role
-- which is blocked by RLS), the whole transaction rolls back and
-- Supabase returns "Database error saving new user".
--
-- Fix:
--   1. Ensure user_tasks and user_bookmarks exist (idempotent).
--   2. Rewrite handle_new_user as SECURITY DEFINER with a proper
--      EXCEPTION block so a task-insert failure never blocks auth.
--   3. Make sure the trigger is correctly bound.
-- =============================================

-- 1. Ensure tables exist (safe to re-run)
CREATE TABLE IF NOT EXISTS user_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  due_date    TEXT,
  status      TEXT NOT NULL DEFAULT 'Planned' CHECK (status IN ('Now', 'Soon', 'Planned', 'Done')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation
DROP POLICY IF EXISTS "tasks_user_all" ON user_tasks;
CREATE POLICY "tasks_user_all" ON user_tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_bookmarks (
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  scholarship_id  UUID REFERENCES scholarships(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scholarship_id)
);

ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookmarks_user_all" ON user_bookmarks;
CREATE POLICY "bookmarks_user_all" ON user_bookmarks
  FOR ALL USING (auth.uid() = user_id);

-- 2. Replace handle_new_user with a robust SECURITY DEFINER version
--    that will never crash sign-up even if the task insert fails.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create the user profile row
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  -- Seed default tasks (best-effort — failure must NOT block sign-up)
  BEGIN
    INSERT INTO user_tasks (user_id, title, due_date, status)
    VALUES
      (NEW.id, 'Complete your profile details',       'Today',     'Now'),
      (NEW.id, 'Run AI Match to find scholarships',   'Soon',      'Soon'),
      (NEW.id, 'Bookmark your top 3 choices',         'Next week', 'Planned');
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but do not re-raise so auth succeeds
    RAISE WARNING 'handle_new_user: could not seed default tasks for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure the trigger is bound (recreate idempotently)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

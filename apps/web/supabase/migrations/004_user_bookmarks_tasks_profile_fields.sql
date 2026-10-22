-- =============================================
-- BairePorbo User Bookmarks + Tasks + Profile Fields
-- Migration: 004_user_bookmarks_tasks_profile_fields
-- =============================================

-- Extend profiles with readiness fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cgpa NUMERIC,
  ADD COLUMN IF NOT EXISTS work_experience TEXT,
  ADD COLUMN IF NOT EXISTS target_degree TEXT,
  ADD COLUMN IF NOT EXISTS preferred_countries TEXT,
  ADD COLUMN IF NOT EXISTS goals_notes TEXT;

-- User bookmarks
CREATE TABLE IF NOT EXISTS user_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scholarship_id UUID NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scholarship_id)
);

ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_bookmarks_read_own" ON user_bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_bookmarks_insert_own" ON user_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_bookmarks_delete_own" ON user_bookmarks
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_id
  ON user_bookmarks (user_id, created_at DESC);

-- User tasks
CREATE TABLE IF NOT EXISTS user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'Planned'
    CHECK (status IN ('Now', 'Soon', 'Planned', 'Done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_tasks_read_own" ON user_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_tasks_write_own" ON user_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id
  ON user_tasks (user_id, created_at DESC);

-- Auto-update updated_at for tasks
CREATE OR REPLACE FUNCTION update_user_tasks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_tasks_updated_at ON user_tasks;
CREATE TRIGGER trg_user_tasks_updated_at
  BEFORE UPDATE ON user_tasks
  FOR EACH ROW EXECUTE FUNCTION update_user_tasks_timestamp();

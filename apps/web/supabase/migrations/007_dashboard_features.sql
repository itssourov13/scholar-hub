-- =============================================
-- BairePorbo Schema Migration: 007_dashboard_features
-- Add Bookmarks and Tasks for the student dashboard
-- =============================================

-- ── Bookmarks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_bookmarks (
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  scholarship_id  UUID REFERENCES scholarships(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scholarship_id)
);

ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmarks_user_all" ON user_bookmarks
  FOR ALL USING (auth.uid() = user_id);

-- ── Tasks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  due_date    TEXT, -- 'Today', 'Wed', 'Next week', etc. or actual dates
  status      TEXT NOT NULL DEFAULT 'Planned' CHECK (status IN ('Now', 'Soon', 'Planned', 'Done')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_user_all" ON user_tasks
  FOR ALL USING (auth.uid() = user_id);

-- Auto-update updated_at for tasks
CREATE OR REPLACE FUNCTION update_task_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_task_updated_at ON user_tasks;
CREATE TRIGGER trg_user_task_updated_at
  BEFORE UPDATE ON user_tasks
  FOR EACH ROW EXECUTE FUNCTION update_task_timestamp();

-- ── Trigger: Auto-seed default tasks for new profiles ─────────
-- We modify the existing handle_new_user function to also insert default tasks.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  -- Insert default tasks
  INSERT INTO user_tasks (user_id, title, due_date, status)
  VALUES
    (NEW.id, 'Complete your profile details', 'Today', 'Now'),
    (NEW.id, 'Run an AI Match to find scholarships', 'Soon', 'Soon'),
    (NEW.id, 'Bookmark your top 3 choices', 'Next week', 'Planned');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

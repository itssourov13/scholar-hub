-- =============================================
-- BairePorbo Schema Migration: 002_auth_and_scholarships
-- =============================================

-- ── Profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  full_name  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- User can read/update their own profile
CREATE POLICY "profiles_user_all" ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── Scholarships ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scholarships (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by          UUID REFERENCES profiles(id),

  -- Admin-provided
  title               TEXT NOT NULL,
  country             TEXT NOT NULL,
  degree_level        TEXT CHECK (degree_level IN ('bachelors','masters','phd','postdoc','any')),
  funding_type        TEXT CHECK (funding_type IN ('full','partial','tuition_only','stipend','other')),
  deadline            DATE,
  official_url        TEXT,
  raw_description     TEXT,

  -- AI-enriched
  eligibility_summary TEXT,
  competitiveness     TEXT,
  tips                TEXT,
  tags                TEXT[],
  ai_summary          TEXT,
  thumbnail_prompt    TEXT,

  -- Admin-uploaded thumbnail
  thumbnail_url       TEXT,

  -- Workflow status
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','published','archived')),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE scholarships ENABLE ROW LEVEL SECURITY;

-- Public: can read published scholarships
CREATE POLICY "scholarships_public_read" ON scholarships
  FOR SELECT USING (status = 'published');

-- Admin: full access
CREATE POLICY "scholarships_admin_all" ON scholarships
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_scholarship_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scholarship_updated_at ON scholarships;
CREATE TRIGGER trg_scholarship_updated_at
  BEFORE UPDATE ON scholarships
  FOR EACH ROW EXECUTE FUNCTION update_scholarship_timestamp();


-- ── Supabase Storage bucket (run separately if CLI not available) ──
-- In the Supabase dashboard: Storage → New bucket → "scholarship-thumbnails" → Public
INSERT INTO storage.buckets (id, name, public)
VALUES ('scholarship-thumbnails', 'scholarship-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_thumbnails" ON storage.objects
  FOR SELECT USING (bucket_id = 'scholarship-thumbnails');

CREATE POLICY "admin_upload_thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'scholarship-thumbnails' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 018_neon_migration.sql
-- Migrate from Supabase-managed auth to Clerk + Neon.
--
-- Key changes:
--   1. profiles.id changed from UUID (FK → auth.users) to TEXT
--      to store Clerk user IDs (format: user_xxxxxxx).
--   2. All RLS policies referencing auth.uid() are dropped.
--      Auth is now enforced at the API route level (Clerk auth()).
--   3. All other tables that FK → profiles.id are updated to TEXT.
--   4. The handle_new_user trigger/function is dropped — profile
--      creation is handled by the /api/webhooks/clerk route.
--
-- Run this ONCE on a fresh Neon database (or after exporting your
-- Supabase data). Do not run on a Supabase database.
-- ============================================================

-- ── Enable pgvector ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                  TEXT PRIMARY KEY,           -- Clerk user ID (user_xxx)
  role                TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  full_name           TEXT,
  cgpa                NUMERIC(4,2),
  work_experience     TEXT,
  target_degree       TEXT,
  preferred_countries TEXT,
  goals_notes         TEXT,
  bsc_major           TEXT,
  university          TEXT,
  graduation_year     INTEGER,
  research_interests  TEXT,
  published_papers    TEXT,
  ielts_score         TEXT,
  gre_gmat_score      TEXT,
  internships         TEXT,
  portfolio_url       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── scholarships ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scholarships (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by            TEXT,                      -- Clerk admin user ID
  title                 TEXT NOT NULL,
  country               TEXT NOT NULL,
  degree_level          TEXT,
  funding_type          TEXT,
  deadline              TEXT,
  official_url          TEXT,
  raw_description       TEXT,
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','published','archived')),
  thumbnail_url         TEXT,
  is_flagship           BOOLEAN NOT NULL DEFAULT FALSE,
  ai_summary            TEXT,
  eligibility_summary   TEXT,
  competitiveness       TEXT,
  tips                  TEXT,
  tags                  JSONB DEFAULT '[]'::jsonb,
  thumbnail_prompt      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ScholarshipDoc (pgvector RAG) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ScholarshipDoc" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id  UUID REFERENCES scholarships(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  embedding       VECTOR(1024),
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scholarship_doc_embedding_idx
  ON "ScholarshipDoc" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- match_scholarship_docs RPC (called as raw SQL from the app)
CREATE OR REPLACE FUNCTION match_scholarship_docs(
  query_embedding VECTOR(1024),
  match_threshold FLOAT,
  match_count     INT
)
RETURNS TABLE (
  id             UUID,
  scholarship_id UUID,
  content        TEXT,
  similarity     FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    sd.id,
    sd.scholarship_id,
    sd.content,
    1 - (sd.embedding <=> query_embedding) AS similarity
  FROM "ScholarshipDoc" sd
  WHERE 1 - (sd.embedding <=> query_embedding) > match_threshold
  ORDER BY sd.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ── chat_sessions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  anon_key   TEXT,
  title      TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_anon_key_idx ON chat_sessions(anon_key);

-- ── chat_messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON chat_messages(session_id);

-- ── user_bookmarks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_bookmarks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scholarship_id UUID NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, scholarship_id)
);

CREATE INDEX IF NOT EXISTS user_bookmarks_user_id_idx ON user_bookmarks(user_id);

-- ── user_tasks ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_tasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  due_date   TEXT,
  status     TEXT NOT NULL DEFAULT 'Planned'
               CHECK (status IN ('Now','Soon','Planned','Done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_tasks_user_id_idx ON user_tasks(user_id);

-- ── guides ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'Scholarships',
  tags            JSONB DEFAULT '[]'::jsonb,
  intro           TEXT NOT NULL DEFAULT '',
  content         TEXT,
  faqs            JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived')),
  cover_image_url TEXT,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── prompt_cache ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key    TEXT NOT NULL UNIQUE,
  model        TEXT NOT NULL,
  user_message TEXT NOT NULL,
  response     TEXT NOT NULL,
  hit_count    INTEGER NOT NULL DEFAULT 0,
  last_hit_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prompt_cache_key_idx ON prompt_cache(cache_key);
CREATE INDEX IF NOT EXISTS prompt_cache_expires_idx ON prompt_cache(expires_at);

CREATE OR REPLACE FUNCTION bump_prompt_cache_hit(p_cache_key TEXT)
RETURNS VOID LANGUAGE SQL AS $$
  UPDATE prompt_cache SET hit_count = hit_count + 1 WHERE cache_key = p_cache_key;
$$;

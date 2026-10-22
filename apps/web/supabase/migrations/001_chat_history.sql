-- =============================================
-- BairePorbo Chat History Schema
-- Migration: 001_chat_history
-- =============================================

-- Chat Sessions: one session = one conversation thread
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- user_id will be linked to Supabase Auth later; nullable for demo/anon mode
  user_id     UUID,
  -- anon_key lets us group messages without auth (e.g. demo users)
  anon_key    TEXT,
  title       TEXT,                  -- auto-generated from first message
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat Messages: every user/assistant turn in a session
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: fetch all messages for a session, ordered chronologically
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
  ON chat_messages (session_id, created_at ASC);

-- Index: fetch all sessions for a user, newest first
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id
  ON chat_sessions (user_id, updated_at DESC);

-- Index: fetch sessions by anon_key (demo mode)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_anon_key
  ON chat_sessions (anon_key, updated_at DESC);

-- Auto-update updated_at on chat_sessions when a new message is inserted
CREATE OR REPLACE FUNCTION update_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions
    SET updated_at = now()
    WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_session_timestamp
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_timestamp();

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- For now: allow all reads/writes (open policy for MVP / demo mode).
-- When real auth is added, replace with user-scoped policies.
CREATE POLICY "allow_all_sessions" ON chat_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_messages" ON chat_messages
  FOR ALL USING (true) WITH CHECK (true);

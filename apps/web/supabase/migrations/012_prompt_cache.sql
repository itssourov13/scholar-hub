-- =============================================
-- BairePorbo: 012_prompt_cache
-- Cheap Postgres-backed cache for repeated mentor questions.
-- Hash key = sha256(model + system_prompt_version + normalized_user_message + rag_context_hash)
-- Hit rate analytics via hit_count / last_hit_at.
-- =============================================

CREATE TABLE IF NOT EXISTS prompt_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key     TEXT NOT NULL UNIQUE,
  model         TEXT NOT NULL,
  user_message  TEXT NOT NULL,
  response      TEXT NOT NULL,
  hit_count     INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_hit_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_prompt_cache_expires_at
  ON prompt_cache (expires_at);

-- Service role only — never expose this to the public anon role.
ALTER TABLE prompt_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompt_cache_service_only" ON prompt_cache;
CREATE POLICY "prompt_cache_service_only" ON prompt_cache
  FOR ALL USING (false) WITH CHECK (false);
-- (service_role key bypasses RLS, so server-side reads/writes work; clients cannot.)

-- Atomic increment helper used on cache hits.
CREATE OR REPLACE FUNCTION bump_prompt_cache_hit(p_cache_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE prompt_cache
     SET hit_count = hit_count + 1,
         last_hit_at = now()
   WHERE cache_key = p_cache_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

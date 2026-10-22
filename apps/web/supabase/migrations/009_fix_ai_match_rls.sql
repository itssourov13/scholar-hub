-- =============================================
-- BairePorbo Migration: 009_fix_ai_match_rls
-- Fix AI Match feature for student users.
--
-- Problem: match_scholarship_docs RPC runs under the caller's
-- session, which is a student. Students had no SELECT policy on
-- "ScholarshipDoc", so the RPC always returned 0 rows even though
-- the function signature and match/route.ts code were correct.
--
-- Fix: Recreate the function as SECURITY DEFINER so it runs under
-- the role of the function owner (postgres), bypassing the caller's
-- RLS. Also add an explicit student-read policy as a belt-and-
-- suspenders measure.
-- =============================================

-- 1. Allow authenticated users to SELECT from ScholarshipDoc
--    (embeddings are not sensitive; only published scholarship content is stored)
DROP POLICY IF EXISTS "scholarshipdoc_authed_read" ON "ScholarshipDoc";
CREATE POLICY "scholarshipdoc_authed_read" ON "ScholarshipDoc"
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2. Recreate the match function as SECURITY DEFINER so it bypasses
--    RLS entirely (needed when called via supabase.rpc() under a user JWT).
DROP FUNCTION IF EXISTS match_scholarship_docs(vector(1024), float, int);

CREATE OR REPLACE FUNCTION match_scholarship_docs(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 10
) RETURNS TABLE (id uuid, scholarship_id uuid, content text, metadata jsonb, similarity float)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.scholarship_id, d.content, d.metadata,
         1 - (d.embedding <=> query_embedding) AS similarity
  FROM "ScholarshipDoc" d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

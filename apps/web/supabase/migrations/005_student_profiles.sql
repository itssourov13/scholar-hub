-- =============================================
-- BairePorbo Schema Migration: 005_student_profiles
-- Add fields for student dashboard and AI Match
-- =============================================

ALTER TABLE profiles
  ADD COLUMN cgpa NUMERIC(4,2),
  ADD COLUMN work_experience TEXT,
  ADD COLUMN target_degree TEXT CHECK (target_degree IN ('bachelors', 'masters', 'phd', 'postdoc', 'any')),
  ADD COLUMN preferred_countries TEXT,
  ADD COLUMN goals_notes TEXT;

-- Update the RPC to return scholarship_id as well
DROP FUNCTION IF EXISTS match_scholarship_docs(vector(1024), float, int);

CREATE OR REPLACE FUNCTION match_scholarship_docs(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
) RETURNS TABLE (id uuid, scholarship_id uuid, content text, metadata jsonb, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.scholarship_id, d.content, d.metadata,
         1 - (d.embedding <=> query_embedding) as similarity
  FROM "ScholarshipDoc" d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

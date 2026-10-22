-- =============================================
-- BairePorbo RAG Schema: 003_rag_pgvector
-- =============================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "ScholarshipDoc" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR(1024),
  scholarship_id UUID REFERENCES scholarships(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "ScholarshipDoc" ENABLE ROW LEVEL SECURITY;

-- Admin: full access to embeddings
CREATE POLICY "scholarshipdoc_admin_all" ON "ScholarshipDoc"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS scholarshipdoc_embedding_hnsw
  ON "ScholarshipDoc" USING hnsw (embedding vector_cosine_ops);

-- RPC function for semantic search
CREATE OR REPLACE FUNCTION match_scholarship_docs(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
) RETURNS TABLE (id uuid, content text, metadata jsonb, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.content, d.metadata,
         1 - (d.embedding <=> query_embedding) as similarity
  FROM "ScholarshipDoc" d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

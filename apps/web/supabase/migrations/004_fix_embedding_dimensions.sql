-- =============================================
-- BairePorbo RAG Schema: 004_fix_embedding_dimensions
-- Change vector dimensions from 1536 → 1024 to match
-- nvidia/nv-embedqa-e5-v5 model output size.
-- =============================================

-- Drop the HNSW index (cannot ALTER dimension with index present)
DROP INDEX IF EXISTS scholarshipdoc_embedding_hnsw;

-- Clear existing embeddings (dimension change requires full re-ingest)
DELETE FROM "ScholarshipDoc";

-- Change the embedding column to 1024 dimensions
ALTER TABLE "ScholarshipDoc"
  ALTER COLUMN embedding TYPE VECTOR(1024);

-- Recreate the HNSW index with the correct dimension
CREATE INDEX scholarshipdoc_embedding_hnsw
  ON "ScholarshipDoc" USING hnsw (embedding vector_cosine_ops);

-- Recreate the RPC function with the correct dimension
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

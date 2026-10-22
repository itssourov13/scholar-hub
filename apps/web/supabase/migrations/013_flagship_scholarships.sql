-- =============================================
-- Migration: 013_flagship_scholarships
-- Adds is_flagship flag so admins can pin
-- specific scholarships to the top of the list.
-- =============================================

ALTER TABLE scholarships
  ADD COLUMN IF NOT EXISTS is_flagship BOOLEAN NOT NULL DEFAULT false;

-- Create an index so sorting flagship-first is fast
CREATE INDEX IF NOT EXISTS idx_scholarships_flagship ON scholarships (is_flagship DESC, created_at DESC);

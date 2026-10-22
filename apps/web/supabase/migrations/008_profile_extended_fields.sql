-- =============================================
-- BairePorbo Profile Extended Fields
-- Migration: 008_profile_extended_fields
-- =============================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bsc_major TEXT,
  ADD COLUMN IF NOT EXISTS university TEXT,
  ADD COLUMN IF NOT EXISTS graduation_year INTEGER,
  ADD COLUMN IF NOT EXISTS research_interests TEXT,
  ADD COLUMN IF NOT EXISTS published_papers TEXT,
  ADD COLUMN IF NOT EXISTS ielts_score TEXT,
  ADD COLUMN IF NOT EXISTS gre_gmat_score TEXT,
  ADD COLUMN IF NOT EXISTS internships TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT;

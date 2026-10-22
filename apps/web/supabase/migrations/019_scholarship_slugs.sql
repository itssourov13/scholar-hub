-- 019_scholarship_slugs.sql
-- Add SEO-friendly slug column to the scholarships table.
-- Slugs replace UUID-based public URLs: /scholarships/{slug}
-- UUID URLs remain valid and automatically 301-redirect to the slug URL.

ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS slug TEXT;

-- Partial unique index: only enforce uniqueness among non-null slugs
CREATE UNIQUE INDEX IF NOT EXISTS idx_scholarships_slug
  ON scholarships (slug)
  WHERE slug IS NOT NULL;

-- Existing scholarships will have slugs backfilled via:
--   POST /api/admin/scholarships/generate-slugs
-- New scholarships receive a slug automatically at creation time
-- (see api/admin/scholarships/route.ts).

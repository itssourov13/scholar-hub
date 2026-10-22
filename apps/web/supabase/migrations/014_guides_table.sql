-- =============================================
-- Migration: 014_guides_table
-- Creates the guides table for AI-assisted
-- blog/FAQ content managed from the admin panel.
-- =============================================

CREATE TABLE IF NOT EXISTS guides (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        UNIQUE NOT NULL,
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  category    TEXT        NOT NULL DEFAULT 'Scholarships',
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  intro       TEXT        NOT NULL DEFAULT '',
  faqs        JSONB       NOT NULL DEFAULT '[]',
  status      TEXT        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by slug (public page rendering)
CREATE INDEX IF NOT EXISTS idx_guides_slug ON guides (slug);

-- Sort by published_at for the public listing
CREATE INDEX IF NOT EXISTS idx_guides_status_published ON guides (status, published_at DESC);

-- Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION update_guides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guides_updated_at ON guides;
CREATE TRIGGER trg_guides_updated_at
  BEFORE UPDATE ON guides
  FOR EACH ROW EXECUTE FUNCTION update_guides_updated_at();

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- Anyone can read published guides (public pages, sitemap)
CREATE POLICY "guides_public_select"
  ON guides FOR SELECT
  USING (status = 'published');

-- Admins have full access (service role bypasses RLS anyway,
-- but this covers any future anon admin key scenarios)
CREATE POLICY "guides_admin_all"
  ON guides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

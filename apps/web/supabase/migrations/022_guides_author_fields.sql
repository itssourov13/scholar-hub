-- Add optional author/writer fields to guides table
-- Used by the manual guide entry mode to display a byline on published guides.
ALTER TABLE guides ADD COLUMN IF NOT EXISTS writer_name        TEXT    DEFAULT NULL;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS writer_designation TEXT    DEFAULT NULL;

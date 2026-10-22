-- Add optional cover image URL to guides
ALTER TABLE guides ADD COLUMN IF NOT EXISTS cover_image_url TEXT DEFAULT NULL;

-- Add is_pinned flag to guides table so a guide can be fixed at position 1
ALTER TABLE guides ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Pin the scholarship documents guide as the most important guide for BD students
UPDATE guides SET is_pinned = TRUE WHERE slug = 'scholarship-application-documents-guide';

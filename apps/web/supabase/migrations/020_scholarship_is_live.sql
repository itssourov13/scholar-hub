-- Add is_live and opening_note columns to scholarships table
-- is_live: true = scholarship is currently accepting applications (deadline required)
-- is_live: false = scholarship is not yet open but will open in future (recurring or upcoming)
-- opening_note: optional note about when it typically opens / expected timeline

ALTER TABLE scholarships
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS opening_note TEXT;

-- Index for filtering live vs upcoming on the public listing
CREATE INDEX IF NOT EXISTS scholarships_is_live_idx ON scholarships (is_live);

-- Backfill: existing scholarships are assumed live (default true already handles this)
-- Admins can edit individual scholarships to mark them as not live where needed.
-- Special case: scholarships with deadline = 'Rolling' or similar free-text that are
-- truly recurring/upcoming should be updated manually via the admin edit page.

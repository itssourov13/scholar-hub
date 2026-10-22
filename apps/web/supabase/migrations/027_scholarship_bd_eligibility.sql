-- Bangladeshi-student eligibility flag, populated by the AI "Parse + Scrape"
-- step on the admin "Add scholarship" page.
--
-- bangladeshi_eligible:
--   true  = Bangladeshi nationals appear eligible to apply. Default/unknown
--           also reads as true (most scholarships don't restrict by
--           nationality, so we avoid false negatives that would hide a
--           legitimate scholarship from admins).
--   false = the scholarship text (or AI knowledge) indicates Bangladeshi
--           nationals are excluded (e.g. "EU citizens only", "US citizens
--           and permanent residents only"). The admin UI shows a warning
--           in this case so the admin doesn't add a scholarship Bangladeshi
--           students can't actually use.
--
-- bangladeshi_eligibility_note: short AI-generated reason for the
-- determination above, shown alongside the warning/confirmation.

ALTER TABLE scholarships
  ADD COLUMN IF NOT EXISTS bangladeshi_eligible BOOLEAN,
  ADD COLUMN IF NOT EXISTS bangladeshi_eligibility_note TEXT;

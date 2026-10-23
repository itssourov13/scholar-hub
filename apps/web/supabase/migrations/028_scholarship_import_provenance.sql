-- ScholarHub catalogue import provenance and the existing document-cache field.
-- Additive only: preserves scholarship rows and never publishes records.
BEGIN;

ALTER TABLE public.scholarships
  ADD COLUMN IF NOT EXISTS required_documents jsonb,
  ADD COLUMN IF NOT EXISTS source_dataset text,
  ADD COLUMN IF NOT EXISTS source_record_id text,
  ADD COLUMN IF NOT EXISTS source_observed_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_verification_status text NOT NULL DEFAULT 'unverified';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.scholarships'::regclass
      AND conname = 'scholarships_source_verification_status_check'
  ) THEN
    ALTER TABLE public.scholarships
      ADD CONSTRAINT scholarships_source_verification_status_check
      CHECK (source_verification_status IN ('unverified', 'verified', 'rejected', 'needs_update'));
  END IF;
END
$$;

-- Stable per-source identity makes repeat imports idempotent without conflating
-- distinct scholarships that happen to share an application portal URL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_scholarships_source_record
  ON public.scholarships (source_dataset, source_record_id)
  WHERE source_dataset IS NOT NULL AND source_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scholarships_unverified_review_queue
  ON public.scholarships (status, created_at DESC)
  WHERE source_verification_status = 'unverified';

COMMIT;

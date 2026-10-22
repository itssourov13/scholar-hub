-- Migrate deadline from DATE to TEXT to support flexible formats
ALTER TABLE scholarships ALTER COLUMN deadline TYPE TEXT;

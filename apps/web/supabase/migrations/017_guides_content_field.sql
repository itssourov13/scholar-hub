-- Migration: 017_guides_content_field
-- Adds a full article/blog post body field to guides.
-- Content is stored as plain Markdown text and rendered before the FAQ section.

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';

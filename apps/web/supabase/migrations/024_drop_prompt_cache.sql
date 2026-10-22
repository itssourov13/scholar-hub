-- =============================================
-- BairePorbo: 024_drop_prompt_cache
--
-- Removes the mentor response cache added in 012.
--
-- It no longer earns its keep: mentor answers now embed the student's profile
-- summary and quote scholarship rows read live at request time, so a cache key
-- that is safe (no cross-student leakage, no stale deadlines) is effectively
-- unique per request. Measured lifetime hit rate before removal was 59 hits
-- across 143 entries, against an AI spend low enough not to justify the risk.
--
-- The table held only regenerable AI output — no user-owned data is lost.
-- =============================================

DROP FUNCTION IF EXISTS bump_prompt_cache_hit(TEXT);
DROP TABLE IF EXISTS prompt_cache;

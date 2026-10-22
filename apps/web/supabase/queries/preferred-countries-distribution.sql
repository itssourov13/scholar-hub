-- ============================================================
-- preferred-countries-distribution.sql
-- Which five countries deserve a Country_Rules entry? (Req 8.2, 8.3)
--
-- `profiles.preferred_countries` is free text a student typed — "Germany",
-- "Germany, Canada", "USA / UK", sometimes Bangla — so a plain GROUP BY on the
-- column counts strings rather than countries. This splits on the separators
-- students actually use, mirroring `splitCountries` in
-- `apps/web/src/lib/roadmap/inputs.ts`, then folds case and trims.
--
-- READ-ONLY. Two SELECTs, no DDL, no writes. Safe to run against production.
--
-- HOW TO READ THE RESULT
--
--   * Query 1 ranks countries by the number of distinct students who named
--     them. `students` is the number that matters; `share_pct` is that count
--     over all profiles naming at least one country.
--   * The design's default five are Germany, Canada, USA, UK and Japan. Replace
--     one only when a country outside that set outranks the fifth by a margin
--     the sample size supports — a 3-student gap on 40 profiles is noise, and
--     swapping a rule set costs a milestone pair plus its document keys.
--   * Aliases matter as much as the ranking. Any spelling in query 2 that the
--     engine does not already recognise belongs in `COUNTRY_ALIASES`
--     (`apps/web/src/lib/roadmap/evidence.ts`); an unrecognised spelling falls
--     through to the Generic_Path, which is honest but loses the country steps.
--     Bangla spellings are deliberately absent from the alias lists today — the
--     wizard writes the English name it offered — so a Bangla row here is a
--     signal about the wizard, not a missing alias.
--   * Record the ranking, the sample size and the decision in the task notes.
--     Until then Germany, Canada, USA, UK and Japan stand as the design default
--     and `country-rules.ts` hardcodes exactly those five.
-- ============================================================

-- ── 1. Ranked country distribution ──────────────────────────────────────────
WITH named AS (
  SELECT
    p.id AS user_id,
    -- Same separator set as splitCountries(): comma, semicolon, slash, pipe,
    -- and the word "and".
    btrim(lower(part)) AS country
  FROM public.profiles p
  CROSS JOIN LATERAL regexp_split_to_table(
    p.preferred_countries, '\s*(,|;|/|\||\yand\y)\s*'
  ) AS part
  WHERE p.preferred_countries IS NOT NULL
    AND btrim(p.preferred_countries) <> ''
),
cleaned AS (
  SELECT user_id, country
  FROM named
  WHERE country <> ''
),
totals AS (
  SELECT COUNT(DISTINCT user_id) AS profiles_naming_a_country FROM cleaned
)
SELECT
  c.country,
  COUNT(DISTINCT c.user_id)                                             AS students,
  ROUND(100.0 * COUNT(DISTINCT c.user_id) / NULLIF(t.profiles_naming_a_country, 0), 1)
                                                                        AS share_pct,
  t.profiles_naming_a_country                                           AS sample_size
FROM cleaned c
CROSS JOIN totals t
GROUP BY c.country, t.profiles_naming_a_country
ORDER BY students DESC, c.country ASC;

-- ── 2. Raw spellings behind each of the design's five, for the alias lists ──
SELECT
  btrim(lower(part))        AS spelling,
  COUNT(*)                  AS occurrences
FROM public.profiles p
CROSS JOIN LATERAL regexp_split_to_table(
  p.preferred_countries, '\s*(,|;|/|\||\yand\y)\s*'
) AS part
WHERE p.preferred_countries IS NOT NULL
  AND btrim(part) <> ''
GROUP BY 1
ORDER BY occurrences DESC, spelling ASC;

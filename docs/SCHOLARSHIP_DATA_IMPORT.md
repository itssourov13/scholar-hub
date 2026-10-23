# Scholarship catalogue import and review

_Last updated: 2026-10-23. The importer still writes only to explicitly allowed staging; the Production schema now exists, but no Production scholarship data has been imported._

## Purpose and guardrails

`apps/web/cleaned_scholarships.json` contains 309 candidate records derived from a social-post dataset. It is source material, not a vetted catalogue. This workflow uses conservative mapping, explicit provenance and an idempotent source key.

- The importer is **read-only by default**. It does not insert records unless `--apply --target staging` and the exact staging-host allowlist are supplied.
- A record is considered importable only when title, country (required by the existing schema), and a valid HTTP(S) official-link field are present, and its normalised source URL/title+country do not collide with another source row or existing DB record.
- Every imported row is `status='draft'`, `is_live=false`, and `source_verification_status='unverified'`. No automatic publication, eligibility claim, or AI enrichment occurs.
- Missing, malformed, duplicate, expired, or unverified facts remain warnings for human review. The importer preserves the provided deadline text and source summary; it does not infer a new application cycle.
- Rows held out by the first pass remain in the JSON file. Resolve each review reason before deliberately revising/re-running the import.

## Data mapping

| Source field | Destination / handling |
|---|---|
| `title` | `scholarships.title`; required |
| `country` | `scholarships.country`; required because current schema is `NOT NULL` |
| `degree` | Recognised levels mapped to `bachelors`, `masters`, `phd`, `postdoc`, `any`; multiple levels joined by ` | ` |
| `funding` | Conservative mapping to UI-supported `full`, `partial`, `tuition_only`, `stipend`; unknown stays null |
| `deadline` | Kept as source text (existing DB column is text); old dates flagged, not rewritten |
| `official_link` | Preserved as `official_url` after HTTP(S)/credential/host validation; importer does not fetch URLs |
| `summary` | Preserved as `raw_description`; never represented as verified AI summary |
| `telegram_date` | Parsed into `source_observed_at` when valid |
| Source identity | `source_dataset` + deterministic SHA-256 `source_record_id`; a partial unique index makes reruns idempotent |
| Verification | Imported rows use `source_verification_status='unverified'`, `source_verified_at=NULL`, `source_last_checked_at=NULL` |

The additive migration `apps/web/supabase/migrations/028_scholarship_import_provenance.sql` adds `required_documents` (already queried by current app code), source provenance fields, a constrained verification status, and source identity/review indexes. It was applied on staging and then included in the approved Production schema transaction (`018`–`028`) on 2026-10-23. Production schema verification passed, but this did not import rows. Existing historical migrations contain duplicate sequence numbers and Supabase-specific assumptions; do not replay every migration blindly.

## Run it

From `apps/web`, after dependencies are installed:

```bash
# Read-only assessment; uses DATABASE_URL to inspect existing rows.
pnpm import:scholarships

# Write only to the explicit, reviewed Neon staging endpoint.
SCHOLARHUB_IMPORT_TARGET=staging SCHOLARHUB_STAGING_HOST='<exact-staging-pooler-host>' pnpm exec tsx --env-file=.env.local --tsconfig tsconfig.json scripts/import-scholarships.ts --apply --target staging
```

Do not set `SCHOLARHUB_STAGING_HOST` to a production endpoint. The script fails closed if the target name or exact host does not match. Rows are inserted individually using `ON CONFLICT ... DO NOTHING` on the stable source identity; after an interruption, a rerun skips successfully imported rows.

## Current result (2026-10-23)

- Dataset size: 309.
- 94 candidates imported into the configured staging branch.
- 215 candidates were held out for review because required fields and duplicate identity checks could not be resolved automatically. The full-source syntax audit found 166 missing official URLs, 81 missing countries and 14 rows within duplicate-URL groups; these counts overlap, so they do not add up to the held-out count.
- Staging verification confirms 94 rows total, all 94 drafts, all 94 unverified, zero published/live records and zero `ScholarshipDoc` rows. A subsequent date audit found 58 of these 94 have past ISO-format deadlines and the other 36 have no deadline; every record needs current-cycle review before publication. The full 309-row JSON has 183 past ISO-format dates and 125 missing deadlines. These are source-date checks, not proof that a programme is permanently closed. RAG embeddings were not generated.
- A repeat read-only dry-run confirmed the 94 existing source identities classify as `already_imported` and yielded zero new import candidates, demonstrating idempotence.

## Manual review before publication

1. Open each official provider/university/government page in a browser and confirm the correct programme and application cycle.
2. Re-check deadline, open/closed status, nationality and academic eligibility, degree level, funding components/conditions, and true application URL.
3. Record evidence in the review process; correct or reject inaccurate records. Never infer Bangladeshi eligibility from host country or post title alone.
4. Publish only records whose material claims are verified and whose intake remains relevant. For an old deadline, check for a new cycle; do not silently roll the date forward.
5. Before enabling RAG, fix and test the route-level publication/verification gates: single-record ingestion currently loads by ID without enforcing `status=published` plus verified source state; batch ingestion filters only on `status=published`; mentor retrieval must not treat draft/unverified vectors as authoritative. Only then run RAG ingestion for the approved verified/public content with `OPENROUTER_API_KEY` configured.
6. Production schema has been created and verified on `br-divine-grass-a16og13f`, but Production currently has no scholarship rows. Import only the reviewed candidates into Production via a separate controlled production-capable workflow; the existing importer intentionally supports staging writes only. Keep the exact staging/production URLs separate.

## Production status and adjacent content

- Production schema migrations `018`–`028` were applied and verified on 2026-10-23. Production currently has 0 scholarship rows, 0 `ScholarshipDoc` rows and 0 guide rows. No data was copied from staging as part of schema migration.
- Guide content has its own `guides` table and the current public guide reader returns only `status='published'` rows from that table; it does not use a static fallback. A trusted source for the initial guide content still needs to be found/confirmed and imported or created before the Guides section can show real content in Production.
- Profiles, chat, bookmarks, tasks, CVs/analyses and roadmaps are user-generated domains. Their schema exists, but the checked staging tables contain no such records. They should fill from real user activity after deployment; do not seed synthetic/private user data. Migrate any real legacy private data separately only if a source is identified and authorised.

## Known limitations

- The dataset has no stable provider ID. Its fingerprint uses normalised title, country and official URL; material identity changes can produce a new source key and require review.
- URL syntax validation does not confirm that a URL resolves, belongs to the official provider, or is current.
- Duplicate URL groups are held for review, not automatically merged.
- `source_verification_status` is in the database but is not yet wired to a complete admin verification UI or enforced publish policy. This is a pre-release code task. Manual guidance in this document is not a substitute for server-side enforcement.
- This import did not create embeddings, verified current-cycle content, or private user data.

# Scholarship catalogue import and review

_Last updated: 2026-10-23. Current import is staging-only; production has not been written._

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

The additive migration `apps/web/supabase/migrations/028_scholarship_import_provenance.sql` adds `required_documents` (already queried by current app code), source provenance fields, a constrained verification status, and source identity/review indexes. It was applied and schema-checked on the configured Neon staging branch only. Existing historic migrations contain duplicate sequence numbers and Supabase-specific assumptions; do not blindly replay every migration on an empty production branch.

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
- 215 candidates were held out for human review, chiefly missing official URLs, missing countries, and duplicate official URLs inside the source dataset.
- Staging verification confirms 94 rows total, all 94 drafts, all 94 unverified, and zero published/live records. `ScholarshipDoc` remains empty; RAG embeddings were not generated.
- A repeat read-only dry-run confirmed the 94 existing source identities classify as `already_imported` and yielded zero new import candidates, demonstrating idempotence.

## Manual review before publication

1. Open each official provider/university/government page in a browser and confirm the correct programme and application cycle.
2. Re-check deadline, open/closed status, nationality and academic eligibility, degree level, funding components/conditions, and true application URL.
3. Record evidence in the review process; correct or reject inaccurate records. Never infer Bangladeshi eligibility from host country or post title alone.
4. Publish only records whose material claims are verified and whose intake remains relevant. For an old deadline, check for a new cycle; do not silently roll the date forward.
5. Run the existing RAG-ingest workflow only after verified records are published and `OPENROUTER_API_KEY` is configured. RAG ingestion is separate from the catalogue import.
6. Before production use, decide which visible Neon project is canonical and provision/verify a real schema on the intended production branch; see the local-only `report.md` for current environment findings.

## Known limitations

- The dataset has no stable provider ID. Its fingerprint uses normalised title, country and official URL; material identity changes can produce a new source key and require review.
- URL syntax validation does not confirm that a URL resolves, belongs to the official provider, or is current.
- Duplicate URL groups are held for review, not automatically merged.
- `source_verification_status` is in the database but not yet wired to a complete admin verification UI or enforce-publish policy. Until that is implemented, drafts must be manually reviewed before an admin changes status.
- This import did not create embeddings, verified current-cycle content, or private user data.

# Scholarship catalogue import and review

_Last updated: 2026-10-24. The existing importer remains staging-only; a separately reviewed Phase 1 batch has been written to Singapore Production._

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
5. The local branch now restricts single/batch RAG ingestion and Mentor fact hydration/title search to `status=published` plus `source_verification_status=verified`; it also adds an enforced Admin publish gate. Those changes pass the current local full test/build pipeline but are not yet hosted. Add focused vector-retrieval tests, deploy/verify the guard, then deliberately generate RAG embeddings only for approved records with `OPENROUTER_API_KEY` configured.
6. Production schema is on `br-divine-grass-a16og13f` and the Phase 1 content batch is now present. For future bulk review/import, use a separate controlled Production-capable workflow; the existing importer intentionally supports staging writes only. Keep exact staging/production targets separate.

## Production status and adjacent content

- Production schema migrations `018`–`028` were applied and verified on 2026-10-23. At that historical checkpoint there were 0 scholarship rows, 0 `ScholarshipDoc` rows and 0 guides; a separate Phase 1 write on 2026-10-24 has since added 5 published verified scholarships and 5 guides. No staging rows were copied as part of that write.
- Guide content has its own `guides` table and the public reader returns only `status='published'` rows; it has no static fallback. Five source-linked editorial guides were created and published in Production on 2026-10-24; staging still has zero guides.
- Profiles, chat, bookmarks, tasks, CVs/analyses and roadmaps are user-generated domains. Their schema exists, but the checked staging tables contain no such records. They should fill from real user activity after deployment; do not seed synthetic/private user data. Migrate any real legacy private data separately only if a source is identified and authorised.

## Known limitations

- The dataset has no stable provider ID. Its fingerprint uses normalised title, country and official URL; material identity changes can produce a new source key and require review.
- URL syntax validation does not confirm that a URL resolves, belongs to the official provider, or is current.
- Duplicate URL groups are held for review, not automatically merged.
- `source_verification_status` is wired into a minimal Admin confirmation flow and server-side publish gate on local branch `feat/phase1-curated-content`, including timestamps/evidence checks and verification invalidation after material edits. This change is not hosted yet; the existing deployed app still needs the gate deployed and runtime-tested before further content administration.
- This import did not create embeddings, verified current-cycle content, or private user data.

## Phase 1 verified content — 2026-10-24

The prior staging-import results above remain valid and have not been promoted. The user authorised a separate small initial content batch on Neon Singapore Production branch `br-divine-grass-a16og13f` (`neondb`). A single ten-statement SQL transaction inserted/upserted **five scholarships and five guides**. The importer `scripts/import-scholarships.ts` remains staging-only and was not modified to accept Production.

### Published scholarships

| Slug | Current-cycle handling | Bangladesh eligibility | Source |
|---|---|---|---|
| `ubc-international-scholars-september-2027` | Award application deadline 15 Nov 2026, 11:59 p.m. Pacific; UBC's later admission-document/English deadline also recorded | Eligible only subject to all published academic, nomination, first-degree and financial-need criteria | [UBC International Scholars](https://you.ubc.ca/financial-planning/scholarships-awards-international-students/international-scholars) |
| `kaist-international-undergraduate-scholarship-2027` | Regular application opens 10 Nov 2026; closes 14 Jan 2027 6 p.m. KST; recommendation letter 21 Jan | International student admission route; must meet the 2027 admissions guide | [KAIST scholarship](https://admission.kaist.ac.kr/intl-undergraduate/support/scholarships/kaist), [timeline](https://admission.kaist.ac.kr/intl-undergraduate/application/ApplicationGuide/ApplicationTimeline) |
| `global-korea-scholarship-undergraduate-2027` | Track/country/university-specific deadlines; do not state one global date as Bangladesh deadline | Current country/track notice and university rules control | [2027 GKS-U notice](https://www.studyinkorea.go.kr/en/plan/gksNoticeRead.do?bbsId=BBSMSTR_000000000461&nttId=4522) |
| `brunei-government-scholarship-scheme-2027-2028` | Expected to open sometime in Jan 2027; official announcement does not specify close date | **Unknown pending current 2027/2028 terms** | [Brunei Ministry of Education notice](https://www.moe.gov.bn/blog/2026/10/17/surat-pemberitahuan-ministry-of-education-for-his-majesty-the-sultan-and-yang-di-pertuan-negara-brunei-darussalam-governments-scholarship-scheme-general-for-the-academic-session-2027-2028/) |
| `turkiye-scholarships-bachelors-next-cycle` | Exact 2027 dates not yet announced; the official calendar's recurring window is labelled non-confirmed for that cycle | International application subject to next call's criteria | [Full-time programme](https://www.turkiyeburslari.gov.tr/fulltimeprograms), [calendar](https://www.turkiyeburslari.gov.tr/calendar) |

All five have status `published`, source verification state `verified`, official HTTPS links, source-as-of notes, verification timestamps and required-document checklists. “Verified” denotes that the listed source/evidence was reviewed as of 24 October 2026; unknown cycle facts remain explicitly unknown and should be rechecked before the next application period. It is not a guarantee of admission or of an individual applicant's eligibility.

### Published guides

- `scholarship-deadlines-application-timeline`
- `undergraduate-scholarship-document-checklist`
- `personal-statement-study-plan-scholarship`
- `fully-funded-vs-partial-scholarship`
- `how-to-verify-scholarships-avoid-scams`

The guides contain editorial prose, FAQs, last-checked references and direct official-source links. They were reviewed for current-cycle assertions and uncertainty, not copied from an AI-only draft.

### Post-write verification and limits

- Neon read-back: 5 scholarship rows, 5 published, 5 verified; 5 guide rows, 5 published; 0 `ScholarshipDoc` rows. `push_sent_at` was set on each seeded record, so direct seeding does not cause “new content” notification fan-out.
- Live public APIs `/api/scholarships` and `/api/guides` returned HTTP 200 and five entries each. Both index pages returned HTTP 200 but their cached static HTML does not contain the new record titles; all ten direct detail pages returned HTTP 200 with expected H1s. The index HTML retains stale `300+` copy; cached KAIST detail HTML says `Full funding` while the fresh API/DB say `partial`. The local source fixes are not deployed, so the visible collection pages need a new Production build/deploy or authenticated route revalidation.
- A local feature branch adds source-verification enforcement and filters public reads and RAG ingestion/retrieval to both `status='published'` and `source_verification_status='verified'`. The local code has not been pushed/deployed, so these new protections are not yet enforced by the hosted runtime.
- RAG remains intentionally empty: no embeddings were generated. Do not enable AI retrieval until the new local gate passes final test/build checks and has been deployed/verified.

### Cached UI caveat

The fresh public API and database now classify KAIST as `partial`, but cached `/scholarships` and KAIST detail HTML remain stale until the local branch is deployed and those paths are revalidated. The connected Vercel scope has no project entry, so no deployment or privileged revalidation was triggered. Full-page visual freshness is therefore still an open check.

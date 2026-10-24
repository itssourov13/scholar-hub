# Production Database Target and Migration Record

_Last verified: 2026-10-24. Singapore Production schema and Phase 1 content state cross-checked; hosted UI still needs the current local code changes to be deployed._

## Selected target

Use Neon **AWS Asia Pacific 1 (Singapore), `aws-ap-southeast-1`** for the Bangladesh-first audience. The Next.js server-side Vercel Functions are configured for `sin1` in `apps/web/vercel.json`; actual hosted latency still needs measurement after deployment.

- Neon project: **ScholarHub Production Singapore**
- Project ID: `shy-darkness-67521294`
- Production branch: `br-divine-grass-a16og13f` (`production`, primary/default)
- Database: `neondb`
- Staging branch: `br-nameless-fog-a10fo0rl`
- Isolated preflight branch: `br-holy-cell-a1qlrlmy` (kept as migration test evidence for now)

**Connection safety:** both local `.env.local` files currently use the staging branch. Do not copy either local `DATABASE_URL` into Vercel Production. Never print or store database URLs/passwords in docs, Git, logs or chat. The existing Vercel project is confirmed by the user-provided dashboard/build log, but the connected Vercel tool scope cannot inspect its settings. No environment variables have been changed by this assistant. The existing Production deployment is live; the current PR Preview build failed because Preview `DATABASE_URL` is not configured.

## Production migration result — 2026-10-23

With explicit user approval, the existing Clerk/Neon baseline and additive migrations `018`–`028` were applied to **only** production branch `br-divine-grass-a16og13f` in one database transaction. Sixty parsed SQL statements ran successfully. No staging rows were copied and no scholarship or guide was published.

Post-migration read-only verification confirmed:

- PostgreSQL `18.6` on `neondb`.
- **14 public application tables** and **31 public indexes**.
- No missing expected columns among the scholarship import/publish fields and roadmap/profile additions checked.
- `vector` extension present and `public.match_scholarship_docs(...)` function present.
- `prompt_cache` absent, as intended by migration `024`.
- **0 `scholarships` rows, 0 `ScholarshipDoc` RAG rows, and 0 `guides` rows.** This is schema-only setup, not a content migration.

The 14 application tables are `profiles`, `scholarships`, `ScholarshipDoc`, `chat_sessions`, `chat_messages`, `user_bookmarks`, `user_tasks`, `guides`, `user_cvs`, `cv_analyses`, `push_tokens`, `push_reminders_sent`, `roadmaps`, and `milestone_progress`. The Phase 1 content transaction did not write user-owned tables. Do not assume those tables remain empty; check their branch-specific counts before any separate migration, and migrate existing private data only from a verified, authorised source.

## Staging and preflight evidence

| Environment | Verified current state | Use |
|---|---|---|
| Singapore Production `br-divine-grass-a16og13f` | Schema ready; 14 tables, 31 indexes, vector/RAG function present; 5 published verified scholarships, 5 published guides, 0 RAG docs | **Selected Production target and Phase 1 content source.** Verify any further write remains limited to this branch; RAG is intentionally empty. |
| Singapore Staging `br-nameless-fog-a10fo0rl` | 14 tables; 94 scholarships, all `draft`/`unverified`; 0 published, 0 live, 0 RAG docs, 0 guides; profile/CV/chat/roadmap/bookmark/task records checked were 0 | Testing only. Local environment files currently target this branch. |
| Isolated preflight `br-holy-cell-a1qlrlmy` | Baseline `018`–`028` tested before production change; 14 tables, pgvector and RAG function worked; 0 scholarship/RAG data | Keep temporarily as migration evidence. Do not use it as app runtime. |
| Separate US-East project `calm-poetry-87067538` | Empty production branch in `aws-us-east-2` | Not selected. |

## Vercel environment mapping (2026-10-24)

Keep the Vercel environment and Neon branch aligned:

| Vercel environment scope | `DATABASE_URL` target | Neon branch / database | Status |
|---|---|---|---|
| Preview only | Staging `neondb` | `br-nameless-fog-a10fo0rl` | **Pending.** User-provided PR #6 build log shows `DATABASE_URL is not configured` during page-data collection for `/api/admin/guides/[id]/cover`. Add the Staging connection string to Vercel Preview scope and redeploy. |
| Production only | Production `neondb` | `br-divine-grass-a16og13f` | Existing public APIs return the populated Production content; the exact Vercel variable value is not visible to the connected tool scope. |

Set each value as a Sensitive environment variable. Do not select both Preview and Production for one database URL value. Never put the literal connection string in Git-tracked docs, logs, chat, or source files. Preview uses Staging for isolation; Production must never point at `br-nameless-fog-a10fo0rl`. Staging has 94 draft/unverified scholarship rows and no published guides, so its content differs from Production by design.

Historical migrations `001`–`017` include duplicate `004`/`007` prefixes and Supabase-specific assumptions. Do **not** replay them blindly against Neon. The tested fresh-Neon baseline is `018_neon_migration.sql`, followed by additive migrations `019`–`028`.

## Content readiness findings

- `apps/web/cleaned_scholarships.json` contains 309 source candidates. The first conservative importer placed 94 in staging as draft/unverified; 215 remain held for review because minimum fields/duplicates require resolution. Diagnostic reason counts overlap: 166 source rows lack an official URL, 81 lack a country, and 14 rows belong to duplicate-URL groups.
- A syntax-only deadline check of the full 309-row JSON found 183 old ISO-format dates and 125 missing deadlines. In the 94 staging rows, 58 have a past ISO-format deadline and 36 have no deadline. These figures do **not** prove a programme is permanently closed; verify every candidate's official current intake before publication.
- At the 2026-10-23 schema-only checkpoint, Staging and Production had **zero guide records**. The Phase 1 batch on 2026-10-24 has since added five published Production guides (see the Phase 1 section below). Staging still has zero guides. The web guide reader queries only published `guides` rows and has no static/demo fallback.
- RAG documents/embeddings remain empty in both staging and Production. The local `feat/phase1-curated-content` branch adds published+verified filters to single/batch ingestion, public scholarship reads, profile-match hydration and Mentor context; the new source-gate implementation is not hosted yet. Add focused RAG coverage and deploy/verify these guards before ingestion.
- Profiles, CVs, chat sessions/messages, roadmaps, bookmarks, and tasks are currently empty in staging. Do not invent or bulk-seed private user records. If client-provided private data exists in a separate source/archive, identify it and plan a separate, permission-aware migration.

## Pre-deployment order

1. Keep staging separate and audit all source candidates against official provider pages: current-cycle dates, application links, eligibility/nationality, degree level, funding/conditions, and source evidence. Correct, reject, or keep uncertain rows as drafts; do not roll dates forward by guesswork.
2. The local `feat/phase1-curated-content` branch implements an Admin source-verification/publish gate and verified-only public/RAG read filters. Final local lint/typecheck/test/build checks pass; these changes still require authorised push/deployment and hosted runtime verification before they count as production enforcement. Keep AI embeddings empty until that check is done.
3. Initial Guide content is populated: five source-linked editorial guides are published on Production. Future guide additions should follow the same source review and publication checks; do not copy private user data.
4. Phase 1’s initial batch (5 scholarships, 5 guides) is complete and counts are verified. For the next batch, use a separate repeatable Production workflow rather than the staging-only importer; validate row counts/statuses after each write. RAG ingestion is deferred until deployed verification gates are confirmed.
5. The user-provided live Vercel URL now reads the populated Production content, but the connected Vercel tool scope does not expose the project’s settings or environment-variable values. Do not assume every setting was independently validated; if changes are made in Vercel, use the exact Production branch and keep staging credentials separate.
6. Final local Web checks pass (lint, typecheck, 392 tests, build of 56 routes), but the feature branch is not deployed. Obtain user authorisation before pushing/deploying; then revalidate cached list and detail paths and verify the publish/RAG gates in the hosted runtime. The visible directory still has stale `300+` copy and the cached KAIST detail page still says `Full funding` although the live API/DB now use `partial`.

## Migration scope and limits

This migration created **database structure only**. It did not import or publish scholarships, add guide content, generate embeddings, transfer user profiles/CVs/chat history, configure Vercel, or deploy the app. No Vercel credentials have been supplied by this database migration. `docs/PRODUCTION_ROADMAP.md`, `docs/SCHOLARSHIP_DATA_IMPORT.md`, and `docs/VERCEL_DEPLOYMENT.md` record the remaining work.

## Phase 1 content write and live API check — 2026-10-24

- Wrote five reviewed scholarship records and five editorial guides to `br-divine-grass-a16og13f` (`neondb`) in a single transaction. Every scholarship is published with `source_verification_status='verified'`, source verification/last-checked timestamps and official HTTPS links. Guide bodies include source links and FAQs. The transaction used stable `source_dataset`/`source_record_id` identifiers for repeat safety; it did not use the staging-only importer.
- Independent post-write SQL checks: 5 total scholarships, 5 published, 5 verified, 5 guides, 5 published guides, 0 `ScholarshipDoc` rows. All ten seeded rows have `push_sent_at` to prevent notifications from being triggered by direct seeding. No private user data was copied.
- Live smoke test against `https://scholarhub-itssourov13.vercel.app` returned HTTP 200 for both public APIs and lists five of each content type. All five scholarship detail and five guide detail URLs returned HTTP 200 with expected H1s. However, cached static `/scholarships` and `/guide` index HTML still has no new item titles and retains old `300+` metadata; the cached KAIST detail still shows `Full funding` while fresh API/DB say `partial`. An authenticated revalidation or new Production build/deploy is required. The connected Vercel scope still does not expose settings, so env variables were not inspected directly.
- The local code branch adds a server-enforced publish gate and filters public/RAG reads to `published` + `verified`, but those source changes are not yet deployed. Hosted index HTML contains stale `300+` metadata and cached KAIST detail HTML still reports `Full funding`; live APIs/fresh DB data report five records of each type and KAIST `partial`. A user-authorised deploy and cache revalidation are still required. No Vercel operation was triggered.

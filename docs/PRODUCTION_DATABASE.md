# Production Database Target and Migration Record

_Last verified: 2026-10-23. Production schema migration completed; Production content has not been imported._

## Selected target

Use Neon **AWS Asia Pacific 1 (Singapore), `aws-ap-southeast-1`** for the Bangladesh-first audience. The Next.js server-side Vercel Functions are configured for `sin1` in `apps/web/vercel.json`; actual hosted latency still needs measurement after deployment.

- Neon project: **ScholarHub Production Singapore**
- Project ID: `shy-darkness-67521294`
- Production branch: `br-divine-grass-a16og13f` (`production`, primary/default)
- Database: `neondb`
- Staging branch: `br-nameless-fog-a10fo0rl`
- Isolated preflight branch: `br-holy-cell-a1qlrlmy` (kept as migration test evidence for now)

**Connection safety:** both local `.env.local` files currently use the staging branch. Do not copy either local `DATABASE_URL` into Vercel Production. Never print or store database URLs/passwords in docs, Git, logs or chat. The connected Vercel workspace currently exposes no ScholarHub project; no Vercel env variables have been changed and no deploy was triggered.

## Production migration result — 2026-10-23

With explicit user approval, the existing Clerk/Neon baseline and additive migrations `018`–`028` were applied to **only** production branch `br-divine-grass-a16og13f` in one database transaction. Sixty parsed SQL statements ran successfully. No staging rows were copied and no scholarship or guide was published.

Post-migration read-only verification confirmed:

- PostgreSQL `18.6` on `neondb`.
- **14 public application tables** and **31 public indexes**.
- No missing expected columns among the scholarship import/publish fields and roadmap/profile additions checked.
- `vector` extension present and `public.match_scholarship_docs(...)` function present.
- `prompt_cache` absent, as intended by migration `024`.
- **0 `scholarships` rows, 0 `ScholarshipDoc` RAG rows, and 0 `guides` rows.** This is schema-only setup, not a content migration.

The 14 application tables are `profiles`, `scholarships`, `ScholarshipDoc`, `chat_sessions`, `chat_messages`, `user_bookmarks`, `user_tasks`, `guides`, `user_cvs`, `cv_analyses`, `push_tokens`, `push_reminders_sent`, `roadmaps`, and `milestone_progress`. User-owned tables are empty; they will receive real per-user records as people use the app, unless a separately identified legacy database contains private data that must be migrated.

## Staging and preflight evidence

| Environment | Verified current state | Use |
|---|---|---|
| Singapore Production `br-divine-grass-a16og13f` | Schema ready; 14 tables, 31 indexes, vector/RAG function present; 0 scholarships, 0 RAG docs, 0 guides | **Production target.** Do not point the public app here until the required content, secrets and release checks are ready. |
| Singapore Staging `br-nameless-fog-a10fo0rl` | 14 tables; 94 scholarships, all `draft`/`unverified`; 0 published, 0 live, 0 RAG docs, 0 guides; profile/CV/chat/roadmap/bookmark/task records checked were 0 | Testing only. Local environment files currently target this branch. |
| Isolated preflight `br-holy-cell-a1qlrlmy` | Baseline `018`–`028` tested before production change; 14 tables, pgvector and RAG function worked; 0 scholarship/RAG data | Keep temporarily as migration evidence. Do not use it as app runtime. |
| Separate US-East project `calm-poetry-87067538` | Empty production branch in `aws-us-east-2` | Not selected. |

Historical migrations `001`–`017` include duplicate `004`/`007` prefixes and Supabase-specific assumptions. Do **not** replay them blindly against Neon. The tested fresh-Neon baseline is `018_neon_migration.sql`, followed by additive migrations `019`–`028`.

## Content readiness findings

- `apps/web/cleaned_scholarships.json` contains 309 source candidates. The first conservative importer placed 94 in staging as draft/unverified; 215 remain held for review because minimum fields/duplicates require resolution. Diagnostic reason counts overlap: 166 source rows lack an official URL, 81 lack a country, and 14 rows belong to duplicate-URL groups.
- A syntax-only deadline check of the full 309-row JSON found 183 old ISO-format dates and 125 missing deadlines. In the 94 staging rows, 58 have a past ISO-format deadline and 36 have no deadline. These figures do **not** prove a programme is permanently closed; verify every candidate's official current intake before publication.
- Staging and Production have **zero guide records**. The web guide reader queries only published `guides` rows; there is no static/demo fallback. Locate/confirm trusted guide source content, then import/write it with draft/publish handling before claiming Guides are ready.
- RAG documents/embeddings are empty in both staging and Production. The pgvector schema is ready, but AI content retrieval isn't populated. Before ingestion, close the code-level safety gap: the single-scholarship ingest route currently fetches by ID without enforcing published + verified status, batch ingest filters published but not verification state, and mentor retrieval must not treat an unverified/draft vector hit as authoritative. Code changes/tests are a required follow-up; this document change does not fix the runtime behaviour.
- Profiles, CVs, chat sessions/messages, roadmaps, bookmarks, and tasks are currently empty in staging. Do not invent or bulk-seed private user records. If client-provided private data exists in a separate source/archive, identify it and plan a separate, permission-aware migration.

## Pre-deployment order

1. Keep staging separate and audit all source candidates against official provider pages: current-cycle dates, application links, eligibility/nationality, degree level, funding/conditions, and source evidence. Correct, reject, or keep uncertain rows as drafts; do not roll dates forward by guesswork.
2. Implement and test an enforced admin verification/publish flow and RAG ingestion/retrieval safeguards. AI may analyse source documents and prepare drafts; unverified output must remain labelled as such and must not be presented as verified fact.
3. Locate/confirm guide source content; populate Production `guides` after review, with only intentionally published guides publicly visible. Reconcile whether any pre-existing public/private content lives outside the current staging branch.
4. Import the reviewed catalogue and guide content into Production using safe, repeatable, idempotent tools. Verify row counts and statuses. Publish only current, verified scholarship records; then ingest RAG documents from the allowed verified/public set.
5. Connect/import `itssourov13/scholar-hub` into the intended Vercel account. Set the correct project options (`apps/web`, Node 22.x, outside-root source access, Corepack) and add the complete set of required production environment variables. `DATABASE_URL` must be generated for this exact production branch and verified by its branch target, not borrowed from local env files.
6. Run final build/tests and release checklist before the first planned production deployment. The user prefers completing content and env setup before deploying once; do not trigger any Vercel deployment without explicit instruction. After the first deployment, smoke-test production pages, API, authentication, database target, Mentor/Guide flows and essential mobile API journeys before declaring release-ready.

## Migration scope and limits

This migration created **database structure only**. It did not import or publish scholarships, add guide content, generate embeddings, transfer user profiles/CVs/chat history, configure Vercel, or deploy the app. No Vercel credentials have been supplied by this database migration. `docs/PRODUCTION_ROADMAP.md`, `docs/SCHOLARSHIP_DATA_IMPORT.md`, and `docs/VERCEL_DEPLOYMENT.md` record the remaining work.

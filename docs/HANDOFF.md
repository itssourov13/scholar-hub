# Handoff

_Last updated: 2026-10-23 — Singapore Production schema migration completed and verified; first deployment intentionally remains pending content/config readiness._

## Current objective

Prepare a single, coherent first Production release for the Bangladesh-first ScholarHub Web + Mobile clients. Finish real scholarship and Guide content, secure publish/RAG paths, confirm all required Vercel variables and complete release verification **before** the user authorises deployment. No deployment has been triggered.

## Repository and branch

- Workspace: `/home/kali/gpt-workspace/BairePorbo`
- GitHub: `https://github.com/itssourov13/scholar-hub`
- PR #4 catalogue import merged into `main` at `33e88e0a46ad22d84053cc91a382c910b6df1341`.
- Working branch: `audit/production-neon-target`. Do not push/deploy without explicit instruction.
- Web/API: `apps/web` (Next.js, Clerk, Neon/PostgreSQL/pgvector, R2, OpenRouter). Mobile: `apps/mobile` (Expo/React Native).
- Start with `docs/CURRENT_STATE.md`, `docs/PRODUCTION_ROADMAP.md`, `docs/PRODUCTION_DATABASE.md`, `docs/SCHOLARSHIP_DATA_IMPORT.md`, and `docs/VERCEL_DEPLOYMENT.md`.

## Database state (verified 2026-10-23)

- Selected Neon project: **ScholarHub Production Singapore**, `shy-darkness-67521294`, `aws-ap-southeast-1`.
- Production: branch `br-divine-grass-a16og13f`, database `neondb`. Migrations `018`–`028` were applied in one transaction after explicit approval. Verification: PostgreSQL 18.6; 14 public tables; 31 indexes; expected import/profile columns; pgvector and `match_scholarship_docs` present; `prompt_cache` absent; 0 scholarship rows, 0 RAG docs, 0 guides.
- Staging: branch `br-nameless-fog-a10fo0rl`. 94 scholarship rows, all draft/unverified; 0 published/live; 0 RAG docs; 0 guides; checked user-owned tables are empty. 58 of the 94 rows have past ISO-format deadlines; 36 have no deadline.
- Source dataset: `apps/web/cleaned_scholarships.json`, 309 candidates; 94 passed the initial minimum-field import check and 215 were held for review. Full-source diagnostic counts overlap: 166 missing official URLs; 81 missing countries; 14 rows within duplicate-URL groups; 183 past ISO-format dates; 125 missing deadlines. Official current-cycle review has not been done.
- The isolated preflight branch `br-holy-cell-a1qlrlmy` is retained temporarily as test evidence; not an app runtime.
- Both root and `apps/web` local `.env.local` DB URLs target staging. Never use them in Vercel Production.

## Content and code findings

- Public scholarship API filters to `status='published'`. Production contains no content yet, so this endpoint cannot provide real scholarship rows until reviewed content is imported and published.
- Guides are fetched from published rows in `guides`; no static/demo fallback exists. Staging and Production currently have zero guides. Identify/confirm the trusted source content and import/create reviewed guide rows.
- CVs/analyses, profiles, Mentor chats, bookmarks, tasks and roadmaps are user-generated records; staging currently has no rows in the checked tables. Do not fabricate seed user data. Any real private data in a separate legacy source requires a separate authorised migration.
- RAG is not populated. Before creating embeddings, address source-level safety gaps: single-record ingest fetches by ID without published/verified checks; batch ingest checks published status but not source verification; mentor retrieval must not treat draft/unverified vectors as authoritative. Add code/tests before ingestion.
- The current `scripts/import-scholarships.ts` is staging-only by design. Production content needs a separate reviewed, repeatable production import/seed workflow; never change its target guard casually or pass Production as the staging host.
- Connected Vercel tools show no ScholarHub project in scope. Environment variables and deployments are not configured. `apps/web/vercel.json` declares Function region `sin1`.

## Ordered next steps

1. Official-source review of all 309 candidates; prioritise the 94 staging rows but re-assess all 215 held rows. Verify current cycle, links, deadline, eligibility/nationality, degree, funding and requirements. Keep unclear/stale items as draft or reject/archive with a reason.
2. Locate/confirm initial Guide content source and choose the small, useful set to publish. Populate/verify `guides` rather than assume the schema means content is present.
3. Implement server-enforced admin verification/publish rules and safe RAG ingest/retrieval filters; add regression tests. Only after that generate vectors for permitted verified/public content.
4. Create/review a production-capable idempotent importer/seed workflow. Import reviewed scholarship and Guide content into Production and independently verify totals and statuses. Keep drafts unpublicised.
5. Check if any real legacy private user data exists outside staging; migrate it separately only with an identified source and appropriate permissions. Otherwise let user-owned tables populate from legitimate app use.
6. Import the repository into the correct Vercel account, configure `apps/web` as root, Node 22.x, outside-root source access and Corepack. Populate the full env-variable checklist with Production `DATABASE_URL` pointing specifically to `br-divine-grass-a16og13f`; do not reuse local/staging credentials. Keep all secrets out of Git/chat/docs.
7. Before first deployment, complete local/CI/build and credentials-backed auth/API/two-user checks, validate mobile HTTPS API/signing/device steps, and close legal/operator/monitoring/rollback decisions. The user wants content and env setup completed before the first deployment; do not deploy until explicitly asked. Smoke-test actual Production immediately after authorised deploy.

## Do not

- Do not expose database URLs, env files, API keys, Firebase credentials or applicant documents.
- Do not copy or publish all 94 records blindly: every staging row is unverified and has an old/missing deadline flag.
- Do not claim guides, RAG, or the production catalogue are ready just because tables/migrations exist.
- Do not use `SCHOLARHUB_LOCAL_PREVIEW=1` in Vercel/production.
- Do not push, merge, deploy or perform additional Production data writes without the appropriate explicit instruction.

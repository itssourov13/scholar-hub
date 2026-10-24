# Handoff

_Last updated: 2026-10-24 — Phase 1 has five published verified scholarships and five published guides in Singapore Production; local code safeguards still need release deployment._

## Current objective

Prepare a single, coherent first Production release for the Bangladesh-first ScholarHub Web + Mobile clients. Finish real scholarship and Guide content, secure publish/RAG paths, confirm all required Vercel variables and complete release verification **before** the user authorises deployment. No deployment has been triggered.

## Repository and branch

- Workspace: `/home/kali/gpt-workspace/BairePorbo`
- GitHub: `https://github.com/itssourov13/scholar-hub`
- PR #4 catalogue import merged into `main` at `33e88e0a46ad22d84053cc91a382c910b6df1341`.
- Working branch: `feat/phase1-curated-content` (local only). An existing uncommitted user edit in `docs/PRODUCTION_ROADMAP.md` was preserved. Do not push/deploy without explicit instruction.
- Web/API: `apps/web` (Next.js, Clerk, Neon/PostgreSQL/pgvector, R2, OpenRouter). Mobile: `apps/mobile` (Expo/React Native).
- Start with `docs/CURRENT_STATE.md`, `docs/PRODUCTION_ROADMAP.md`, `docs/PRODUCTION_DATABASE.md`, `docs/SCHOLARSHIP_DATA_IMPORT.md`, and `docs/VERCEL_DEPLOYMENT.md`.

## Database state (verified 2026-10-23)

- Selected Neon project: **ScholarHub Production Singapore**, `shy-darkness-67521294`, `aws-ap-southeast-1`.
- Production: branch `br-divine-grass-a16og13f`, database `neondb`. Migrations `018`–`028` were applied in one transaction on 2026-10-23. On 2026-10-24, read-only checks confirmed 5 published verified scholarships, 5 published guides, and 0 RAG documents. The connected Vercel scope does not show project settings, but the user-provided live URL returns these database-backed records from its public APIs.
- Staging: branch `br-nameless-fog-a10fo0rl`. 94 scholarship rows, all draft/unverified; 0 published/live; 0 RAG docs; 0 guides; checked user-owned tables are empty. 58 of the 94 rows have past ISO-format deadlines; 36 have no deadline.
- Source dataset: `apps/web/cleaned_scholarships.json`, 309 candidates; 94 passed the initial minimum-field import check and 215 were held for review. Full-source diagnostic counts overlap: 166 missing official URLs; 81 missing countries; 14 rows within duplicate-URL groups; 183 past ISO-format dates; 125 missing deadlines. Official current-cycle review has not been done.
- The isolated preflight branch `br-holy-cell-a1qlrlmy` is retained temporarily as test evidence; not an app runtime.
- Both root and `apps/web` local `.env.local` DB URLs target staging. Never use them in Vercel Production.

## Content and code findings

- Production has five published and source-reviewed scholarship records. The live public API returned those five rows after the Phase 1 write. The local feature branch additionally filters on `source_verification_status='verified'`; that new guard is not hosted yet.
- Guides are fetched from published rows in `guides`; no static/demo fallback exists. Production now contains five published guides; Staging remains empty. All five direct guide detail URLs return HTTP 200 with expected H1s, but the `/guide` index HTML remains stale/empty until revalidation or a new build/deploy.
- CVs/analyses, profiles, Mentor chats, bookmarks, tasks and roadmaps are user-generated records; staging currently has no rows in the checked tables. Do not fabricate seed user data. Any real private data in a separate legacy source requires a separate authorised migration.
- RAG is not populated. The local source branch adds published+verified filters to single/batch ingestion and Mentor fact hydration/title search. Final local tests/build pass, but those guards are not hosted yet; add focused vector-retrieval tests and deploy/verify before generating embeddings.
- The current `scripts/import-scholarships.ts` is staging-only by design. The initial five scholarship + five guide batch was inserted to Production via a separate reviewed transaction. For future larger batches, create/review a repeatable Production import workflow; never weaken the staging guard or pass Production as the staging host.
- Connected Vercel tools still show no ScholarHub project in scope, so its environment settings cannot be inspected through this connection. The user-provided live URL serves the populated content APIs, but cached index metadata and KAIST funding label remain stale. `apps/web/vercel.json` declares Function region `sin1`; user-authorised deploy/revalidation of the local branch remains open.

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

## Phase 1 work completed (2026-10-24)

- Added five scholarship records and five guide records directly to the selected Singapore Production branch in one transaction. Details/source status, official links, dates, funding and eligibility uncertainties are documented in `SCHOLARSHIP_DATA_IMPORT.md` and the local-only `report.md`.
- The public APIs and all ten direct content routes returned HTTP 200 after the write. The cached index HTML still shows stale `300+` copy; local metadata changes need deployment.
- Added local server-side verification/publish enforcement and verified-only public/RAG filters on `feat/phase1-curated-content`. This branch is not pushed or deployed. Final local lint/typecheck/full test/build results must be read from the Phase 1 report before handoff.
- RAG remains empty; no notifications or private data were seeded. Do not publish further rows or ingest embeddings without fresh source review and verification.
- User-facing follow-up needed: decide when to push this branch and then authorize hosted deployment/revalidation. The assistant did not commit, push or deploy.

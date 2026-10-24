# Handoff

_Last updated: 2026-10-24 — Phase 1 has five published verified scholarships and five published guides in Singapore Production; Vercel Preview → Staging `DATABASE_URL` mapping is documented but still needs configuration and a successful redeploy._

## Current objective

Continue the controlled release of the Bangladesh-first ScholarHub Web + Mobile clients. The existing Production URL is live; Phase 1 is on PR #6 and needs a successful Preview build, content/cache verification, and explicit merge/deploy approval. Confirm required Vercel variables and hosted publish/RAG safeguards before declaring the release ready.

## Repository and branch

- Workspace: `/home/kali/gpt-workspace/BairePorbo`
- GitHub: `https://github.com/itssourov13/scholar-hub`
- PR #4 catalogue import merged into `main` at `33e88e0a46ad22d84053cc91a382c910b6df1341`.
- Working branch: `feat/phase1-curated-content`, pushed to `origin`; PR [#6](https://github.com/itssourov13/scholar-hub/pull/6) is open against `main`. Implementation commit: `14f1e93`; this documentation-only update is tracked separately. Do not merge/deploy without explicit instruction.
- Web/API: `apps/web` (Next.js, Clerk, Neon/PostgreSQL/pgvector, R2, OpenRouter). Mobile: `apps/mobile` (Expo/React Native).
- Start with `docs/CURRENT_STATE.md`, `docs/PRODUCTION_ROADMAP.md`, `docs/PRODUCTION_DATABASE.md`, `docs/SCHOLARSHIP_DATA_IMPORT.md`, and `docs/VERCEL_DEPLOYMENT.md`.

## Database state (latest checks 2026-10-24)

- Selected Neon project: **ScholarHub Production Singapore**, `shy-darkness-67521294`, `aws-ap-southeast-1`.
- Production: branch `br-divine-grass-a16og13f`, database `neondb`. Migrations `018`–`028` were applied in one transaction on 2026-10-23. On 2026-10-24, read-only checks confirmed 5 published verified scholarships, 5 published guides, and 0 RAG documents. The connected Vercel scope does not show project settings, but the user-provided live URL returns these database-backed records from its public APIs.
- Staging: branch `br-nameless-fog-a10fo0rl`. 94 scholarship rows, all draft/unverified; 0 published/live; 0 RAG docs; 0 guides; checked user-owned tables are empty. 58 of the 94 rows have past ISO-format deadlines; 36 have no deadline.
- Source dataset: `apps/web/cleaned_scholarships.json`, 309 candidates; 94 passed the initial minimum-field import check and 215 were held for review. Full-source diagnostic counts overlap: 166 missing official URLs; 81 missing countries; 14 rows within duplicate-URL groups; 183 past ISO-format dates; 125 missing deadlines. Official current-cycle review has not been done.
- The isolated preflight branch `br-holy-cell-a1qlrlmy` is retained temporarily as test evidence; not an app runtime.
- Both root and `apps/web` local `.env.local` DB URLs target staging. Never use them in Vercel Production.

## Vercel environment-to-database mapping (2026-10-24)

| Vercel environment | `DATABASE_URL` target | Neon branch / database | Status |
|---|---|---|---|
| Preview | Staging only | `br-nameless-fog-a10fo0rl` / `neondb` | **Pending configuration and successful redeploy.** The user-provided PR #6 build log fails while collecting `/api/admin/guides/[id]/cover` because `DATABASE_URL` is not configured in Preview. |
| Production | Production only | `br-divine-grass-a16og13f` / `neondb` | Existing live APIs return populated Production content; the environment-variable value itself has not been independently inspected through the connected Vercel tool scope. |

Set `DATABASE_URL` as a Sensitive environment variable in Vercel. For the Staging connection string, select **Preview only**; for the Production connection string, select **Production only**. Never select both scopes for one value, reuse the Staging URL in Production, or store either connection string in Git/docs/chat. Redeploy the Preview deployment after saving the variable: existing deployments do not gain newly added environment variables retroactively. Preview currently has 94 draft/unverified scholarship rows and no guides, so a green Preview build may correctly show no published guides unless reviewed test content is separately seeded into Staging.

## Content and code findings

- Production has five published and source-reviewed scholarship records. The live public API returned those five rows after the Phase 1 write. The local feature branch additionally filters on `source_verification_status='verified'`; that new guard is not hosted yet.
- Guides are fetched from published rows in `guides`; no static/demo fallback exists. Production now contains five published guides; Staging remains empty. All five direct guide detail URLs return HTTP 200 with expected H1s, but the `/guide` index HTML remains stale/empty until revalidation or a new build/deploy.
- CVs/analyses, profiles, Mentor chats, bookmarks, tasks and roadmaps are user-generated records; staging currently has no rows in the checked tables. Do not fabricate seed user data. Any real private data in a separate legacy source requires a separate authorised migration.
- RAG is not populated. The local source branch adds published+verified filters to single/batch ingestion and Mentor fact hydration/title search. Final local tests/build pass, but those guards are not hosted yet; add focused vector-retrieval tests and deploy/verify before generating embeddings.
- The current `scripts/import-scholarships.ts` is staging-only by design. The initial five scholarship + five guide batch was inserted to Production via a separate reviewed transaction. For future larger batches, create/review a repeatable Production import workflow; never weaken the staging guard or pass Production as the staging host.
- The connected Vercel tool scope lacks permission to inspect the existing ScholarHub project's settings; the user-provided dashboard/build log confirms the project exists. The current PR #6 Preview build fails during page-data collection for `/api/admin/guides/[id]/cover` because Preview `DATABASE_URL` is not configured. Set Preview `DATABASE_URL` to Neon Staging as shown above and redeploy. The existing Production URL serves populated APIs, but cached index metadata/Guide listing and the KAIST funding label remain stale. `apps/web/vercel.json` declares Function region `sin1`; authorised merge/deploy and cache refresh remain open.

## Ordered next steps

1. Configure Vercel `DATABASE_URL` for **Preview only** using Neon Staging `br-nameless-fog-a10fo0rl` / `neondb`; then redeploy PR #6 and confirm that page-data collection/build succeeds. Keep Production `DATABASE_URL` scoped to `br-divine-grass-a16og13f` / `neondb` only.
2. Smoke-test the successful Preview build and key APIs/routes. Preview has 94 draft/unverified scholarship rows and no published guides, so an empty published list is expected unless reviewed test data is separately seeded into Staging.
3. Arrange human review of the five Production scholarships—especially Bangladesh-specific eligibility and current-cycle details marked uncertain—before relying on them for applications. Their current status/source evidence and caveats are in `SCHOLARSHIP_DATA_IMPORT.md`.
4. Add/finish focused vector retrieval coverage and keep RAG embeddings empty until the published+verified filters are deployed and independently verified.
5. After explicit approval to merge/deploy, confirm the Production build is green and re-check `/scholarships`, `/guide`, all five guide details, scholarship details, funding labels, metadata and cache revalidation. Confirm the source-verification guard is active in hosted routes.
6. Finish credential-backed auth/API/two-user checks, mobile HTTPS API/signing/device checks, and any remaining legal/operator/monitoring/rollback decisions before calling the release complete.

## Do not

- Do not expose database URLs, env files, API keys, Firebase credentials or applicant documents.
- Do not copy or publish all 94 records blindly: every staging row is unverified and has an old/missing deadline flag.
- Do not claim guides, RAG, or the production catalogue are ready just because tables/migrations exist.
- Do not use `SCHOLARHUB_LOCAL_PREVIEW=1` in Vercel/production.
- Do not push, merge, deploy or perform additional Production data writes without the appropriate explicit instruction.

## Phase 1 work completed (2026-10-24)

- Added five scholarship records and five guide records directly to the selected Singapore Production branch in one transaction. Details/source status, official links, dates, funding and eligibility uncertainties are documented in `SCHOLARSHIP_DATA_IMPORT.md` and the local-only `report.md`.
- The public APIs and all ten direct content routes returned HTTP 200 after the write. The cached index HTML still shows stale `300+` copy; local metadata changes need deployment.
- Added local server-side verification/publish enforcement and verified-only public/RAG filters on `feat/phase1-curated-content`. The branch is pushed and PR #6 is open; it has not been merged or deployed to Production. The user-provided Vercel Preview build failed because Preview `DATABASE_URL` is missing. Local lint/typecheck/tests/build passed before the commit; GitHub Web and Mobile CI both pass.
- RAG remains empty; no notifications or private data were seeded. Do not publish further rows or ingest embeddings without fresh source review and verification.
- Next: configure Preview `DATABASE_URL` for Staging only, redeploy and verify Preview. Then the user can decide whether to merge; Production deploy/cache revalidation remains a separate step.

# Handoff

_Last updated: 2026-10-23 — PR #4 merged; Singapore Neon target selected; schema preflight verified on an isolated branch. Production remains untouched._

## Current objective

Prepare ScholarHub for a Bangladesh-first release with the database in Neon Singapore and server-side Vercel Functions in Singapore. Keep staging and production separate; finish the schema preflight and region/config review before requesting approval for a production migration.

## Repository and branch

- Workspace: `/home/kali/gpt-workspace/BairePorbo`
- GitHub: `https://github.com/itssourov13/scholar-hub`
- PR #4 (`feat: add safe scholarship catalogue import`) is merged into `main` as `33e88e0a46ad22d84053cc91a382c910b6df1341`.
- Current local branch: `audit/production-neon-target`, created from the updated `origin/main`. Do not push or deploy until asked.
- Web: `apps/web`, Next.js 16.4.2, React 19, TypeScript, Clerk, Neon/PostgreSQL/pgvector, R2 and OpenRouter. Mobile: `apps/mobile`, Expo SDK 57 / React Native 0.86.
- Read first: `docs/PROJECT_CONTEXT.md`, `docs/CURRENT_STATE.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/TASK_STATE.md`.

## Database evidence and decision

- Selected project: **ScholarHub Production Singapore**, Neon project `shy-darkness-67521294`, region `aws-ap-southeast-1`.
- Intended production branch: `br-divine-grass-a16og13f`, database `neondb`; it currently has 0 public application tables.
- Staging branch: `br-nameless-fog-a10fo0rl`; it has 14 public tables and 94 scholarship records, all draft/unverified, with 0 published, 0 live, and 0 RAG documents.
- The local `apps/web/.env.local` and root `.env.local` `DATABASE_URL` values resolve to the staging branch. Never set those values as Vercel Production credentials.
- Separate US-East project `calm-poetry-87067538` has an empty production branch and is not selected.
- Preflight branch `br-holy-cell-a1qlrlmy` was created from the chosen production branch; migrations `018`–`028` were tested there. The smoke check verified 14 tables, required scholarship columns, `vector`, the `match_scholarship_docs` function, and zero catalogue/RAG rows. Schema comparison to staging showed only the `slug` column's physical order differed; the column and index exist.
- `apps/web/vercel.json` now configures `regions: ["sin1"]`. No ScholarHub project is visible in the connected Vercel scope; Vercel environment variables and deployment have not been changed.
- Full branch evidence, procedure, and safety gates: `docs/PRODUCTION_DATABASE.md`. Keep the temporary preflight branch until the migration decision is completed; do not write to production without explicit approval.

## Imported catalogue state

- Source file: `apps/web/cleaned_scholarships.json`, 309 candidates.
- Singapore staging has 94 draft rows, all `is_live=false` and `source_verification_status='unverified'`. Another 215 source rows remain held for manual review (reason counts overlap).
- No source URLs/current-cycle eligibility/funding/deadline claims have been verified live with official providers. Do not publish or generate RAG embeddings until records are checked and verified.
- The public `GET /api/scholarships` route serves only `status='published'`, regardless of status query parameters.

## Current next steps

1. Review the focused diff on `audit/production-neon-target` and commit the region/config/documentation changes. Local lint, typecheck, 388 tests, Webpack build, JSON validation, Markdown-link scan and diff checks passed; hosted branch CI remains pending.
2. Apply the reviewed schema baseline to Singapore production branch `br-divine-grass-a16og13f` only after explicit approval and a recorded restore/rollback procedure. Verify branch emptiness immediately before execution; never copy staging rows in this step.
3. Import this repo into the intended Vercel account, set root directory `apps/web`, Node 22.x, include source outside the root directory, set `ENABLE_EXPERIMENTAL_COREPACK=1`, and configure encrypted Production env vars against the production branch only. Keep Preview on staging.
4. Test a preview deployment, confirm the effective function region, and smoke-test pages/APIs/auth/data. Promote only after the deployed app demonstrably uses the intended DB branch.
5. Review all 94 draft rows and the 215 held source rows against official provider sources; build enforceable admin review/publish gating before publication.
6. Finish two-user authorization tests, mobile EAS/signing/device verification, release identity, operator/legal details, monitoring and rollback checks.

## Do not

- Do not expose database URLs, environment files, API keys, Firebase credentials or applicant documents.
- Do not point Vercel Production at the local/staging database branch.
- Do not import/publish the 94 unverified staging records during schema setup.
- Do not use `SCHOLARHUB_LOCAL_PREVIEW=1` in Vercel/production.
- Do not push, merge, deploy or modify production schema/data without the appropriate explicit approval.

# Handoff

_Last updated: 2026-10-23 — controlled scholarship import to staging and source-provenance schema completed; production remains untouched._

## Current objective

Continue adapting the existing application into **ScholarHub**, a broader scholarship discovery and application-management platform. Work in the current workspace; do not create a parallel workspace or greenfield rewrite.

## Exact repository context

- Workspace: `/home/kali/gpt-workspace/BairePorbo`
- Repository: `https://github.com/itssourov13/scholar-hub.git`; PR #1 (Clerk-free local preview fix) is merged into `main` as of 2026-10-22. No production deployment has been verified.
- Main implementation: `apps/web`. Native app: `apps/mobile`. Shared contracts: `packages/shared`.
- Current web foundation: Next.js 16.4.2, React 19, TypeScript, Clerk, Neon/PostgreSQL/pgvector, R2, OpenRouter, optional Redis/NIM. Mobile: Expo SDK 57, React Native 0.86, Clerk Expo.
- API handlers are in `apps/web/src/app/api`; zero-byte `apps/api`/`packages/db` scaffold files were removed from the fresh tree.
- **Active branch:** `feat/scholarship-catalogue-import`, created from the updated `origin/main` at merge `4d95ed1` (PR #3 merged). The preceding Firebase/EAS/Vercel preparation passed [GitHub Actions run 39854247770](https://github.com/itssourov13/scholar-hub/actions/runs/39854247770). This branch adds a safe data import pipeline and public API regression fix; it is local and uncommitted.
- The earlier mobile ignore/auth role-state follow-up is on the existing remote follow-up branch and remains separate from this data-import task. The active scholarship-import branch is intentionally not committed, pushed, or deployed yet; rerun the Web quality gates and review the diff first.
- Latest verification on the active catalogue-import branch used Node 22.23.1 / pnpm 11.1.3: lint and typecheck passed; all 388 tests across 21 files passed; the Webpack build generated 56 static pages/routes; `git diff --check` passed. The second read-only importer run found 94 already-imported records and zero new import candidates. The earlier published head passed hosted CI, including standard Android export; local Android export still fails because the ARM64 host has an x86-64 Hermes compiler.
- The intended `com.scholarhub.app` identity is for a separate ScholarHub app listing, not an in-place update of the legacy BairePorbo listing. The store registration and signing path still need verification. No matching Firebase config is committed; push configuration is needed only if push is included. `keystore.properties` is optional for EAS-managed remote signing.
- Current import status: additive schema migration and 94 unverified draft records were applied to the configured Neon staging branch only. No production branch was modified. The public scholarships API was hardened to return published rows only. Details and manual actions are in the local-only `report.md` and `docs/SCHOLARSHIP_DATA_IMPORT.md`.

## Most recent local preview fix

- The Clerk-free preview change from `fix/preview-clerk-chunk-cache` was pushed and merged through PR #1 (the branch contained `88580cd`, `b098d75`, and its verification documentation). It fixes the local browser handshake issue; no production deployment was verified.
- Reproduced the reported problem in a real Chromium headless browser. The homepage HTML returned successfully but Clerk middleware redirected the actual browser to `clerk.scholarhub.local`; the earlier fix had not addressed this server-side handshake. The current opt-in preview mode bypasses Clerk middleware locally and avoids loading the Clerk SDK in public-page bundles.
- Confirmed page rendering and zero Clerk placeholder-host requests in the browser network log; typecheck passed, 375 web tests passed, and the Webpack build completed. That build deliberately used a dummy DB URL and emitted expected Neon errors. It does not confirm real scholarship data or production readiness.
- Local preview server is currently stopped. Do not set `SCHOLARHUB_LOCAL_PREVIEW=1` for Vercel/production; preview auth routes intentionally return to the public homepage.
- Keep `SCHOLARHUB_LOCAL_PREVIEW=1` limited to trusted local visual review. Never use it in Vercel/production.

## What changed in this phase

- Recreated the missing root README for ScholarHub.
- Added root agent instructions and the requested canonical `docs/` files.
- Replaced the generic web README and updated web-specific agent instructions.
- Removed stale duplicate root project plans/migration notes and the legacy interview brief.
- Updated primary product-name copy, site metadata/schema, PWA/native labels, Expo slug/scheme, Android deep-link scheme, shared package scope, and service-worker cache namespace/version. Removed the former APK/assetlinks, disabled former ad/pixel integrations, made public outbound links configurable, and marked legal policies as pre-release drafts. No database schema, production data, deployed environment, or production deployment was changed.
- Historical mobile/role-state follow-up (2026-10-23): root-caused the Android Metro file-map issue using copied package files, aligned Expo SDK package patches/lockfile, restored `.gitignore` safeguards, and fixed account-switch role-state handling. Published head `608711a` passed hosted Web/Mobile CI, including regular Android export, and is an ancestor of the current `origin/main` merge `4d95ed1`. That historical CI run does not certify the active catalogue-import branch.

## Read first

1. `AGENTS.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/CURRENT_STATE.md`
4. `docs/ARCHITECTURE.md`
5. `docs/DECISIONS.md`
6. `docs/TASK_STATE.md`
7. `docs/SECURITY_AND_PRIVACY.md`
8. `docs/PRODUCTION_ROADMAP.md` — temporary editable plan; review and adjust before starting a phase.

## Next steps

1. The catalogue-import implementation and associated docs are prepared on `feat/scholarship-catalogue-import`. Local lint, typecheck, 388 tests, Webpack build, diff checks, and repeat read-only dry-run passed; the branch-specific hosted CI has not run. After the user pushes this branch, open/update its pull request and inspect both CI jobs. The detailed local-only report is `report.md`; keep it untracked.
2. Resolve the canonical Neon production target. There are two visible Neon projects, and the inspected production branches lacked `public.scholarships`; never point Vercel at one until the intended project/branch is confirmed and the schema is reconciled.
3. Review the 94 staging drafts against official provider sources. Review/repair the other 215 dataset rows where useful; do not publish expired/unknown-cycle records or infer missing facts.
4. Add a mandatory admin review/publish gate for `source_verification_status` and visible provenance. Until then, manually verify records before changing them to published.
5. Only after the intended production branch has a tested schema and approved backup/rollback plan, prepare a separate production migration/import plan. Keep RAG ingestion separate; run it only on verified published records.
6. Finish authorization/API E2E, two-user isolation, Vercel Preview/Production setup and smoke tests, signed EAS build/device checks, app-store identity, push delivery if enabled, and legal/operator/monitoring items.

## Operational commands

From the existing workspace:
- `git status --short --branch`
- `git diff --check`
- `git diff --stat`
- `git remote -v`

When dependencies are correctly installed, use scripts in `apps/web/package.json`: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Mobile scripts are documented in `apps/mobile/package.json`. Confirm package-manager/workspace setup first.

## Do not

- Do not claim ScholarHub is already fully rebranded or production-ready.
- Do not copy the client's original ZIP or private personal documents into Git.
- Do not silently import AI-guessed values as verified facts.
- Do not cache private API responses in a shared service-worker cache.
- Do not change Android IDs, production domains, sign-in providers, signing keys, or existing production credentials without a compatibility/migration plan.
- Do not push, deploy, or make production database changes unless explicitly requested.

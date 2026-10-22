# Handoff

_Last updated: 2026-10-23_

## Current objective

Continue adapting the existing application into **ScholarHub**, a broader scholarship discovery and application-management platform. Work in the current workspace; do not create a parallel workspace or greenfield rewrite.

## Exact repository context

- Workspace: `/home/kali/gpt-workspace/BairePorbo`
- Repository: `https://github.com/itssourov13/scholar-hub.git`; PR #1 (Clerk-free local preview fix) is merged into `main` as of 2026-10-22. No production deployment has been verified.
- Main implementation: `apps/web`. Native app: `apps/mobile`. Shared contracts: `packages/shared`.
- Current web foundation: Next.js 16.4.2, React 19, TypeScript, Clerk, Neon/PostgreSQL/pgvector, R2, OpenRouter, optional Redis/NIM. Mobile: Expo SDK 57, React Native 0.86, Clerk Expo.
- API handlers are in `apps/web/src/app/api`; zero-byte `apps/api`/`packages/db` scaffold files were removed from the fresh tree.
- **Active local branch:** `fix/production-readiness-and-app-id`, based on `fa98e09`. Its work is uncommitted and has not been pushed or merged. Review the full diff before committing.
- Latest passing local checks: web lint/typecheck, 375 web tests (18 files), production build with the configured local environment (56 routes), production dependency audit (no known vulnerabilities), mobile lint/typecheck, Expo SDK check, and Expo Doctor (20/20).
- Android Metro/Router resolution is fixed locally by setting `packageImportMethod: copy` for the mobile pnpm root. The normal Android export bundles 2,216 modules but fails at Hermes bytecode with `SIGILL` because this host is ARM64 and its installed compiler binary is x86-64; the diagnostic `--no-bytecode` export passes (2,216 modules, 77 assets). Hosted Ubuntu CI now checks the normal export, but GitHub Actions has not run yet.
- Added `.github/workflows/ci.yml`; it has passed local YAML parsing, but remains unpushed/unrun remotely. The local web production build passed; no DB migration, seed/import, or production write took place.
- Mobile identifiers remain locally set to `com.scholarhub.app`, but store/update compatibility, Firebase/push, EAS/signing, public HTTPS API, auth/deep links, and real-device tests remain outstanding. See `docs/CURRENT_STATE.md` for evidence and limitations.

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
- Follow-up (2026-10-23): root-caused and fixed the Android Metro file-map issue using copied package files, aligned Expo CLI/Notifications patches and the lockfile, added CI gates, and reran web/mobile checks. The diagnostic Android bundle passes; normal export still fails at Hermes SIGILL on this ARM64 host. The remote CI run remains pending.

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

1. Push the reviewed local branch when ready and inspect the first `.github/workflows/ci.yml` run, especially the regular Android export on hosted Ubuntu. Do not claim remote CI is green before it completes.
2. If the standard export passes on the supported runner, perform an EAS preview/native build, configure the deployed HTTPS API origin, and test a signed internal build on a real device.
3. Decide whether `com.scholarhub.app` is a new store listing or an update to the former app before release. Supply matching Firebase settings if push is in scope, verify OAuth/deep links, and test update/signing compatibility.
4. Configure a dedicated staging Neon `DATABASE_URL`, reconcile migrations with backup/rollback, review the actual scholarship source data, and run an approved dry-run import before writing any records.
5. Add route/API E2E, two-user authorization, accessibility/performance, and deployment smoke tests; review core applicant journeys and their evidence/data requirements.
6. Finalise approved assets, operator/legal/privacy details, production domain/provider credentials, monitoring/rollback, historical source artifacts, and staged-release approval after the appropriate gates pass.

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

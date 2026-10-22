# Handoff

_Last updated: 2026-10-22_

## Current objective

Continue adapting the existing application into **ScholarHub**, a broader scholarship discovery and application-management platform. Work in the current workspace; do not create a parallel workspace or greenfield rewrite.

## Exact repository context

- Workspace: `/home/kali/gpt-workspace/BairePorbo`
- Repository: `https://github.com/itssourov13/scholar-hub.git`; PR #1 (Clerk-free local preview fix) is merged into `main` as of 2026-10-22. No production deployment has been verified.
- Main implementation: `apps/web`. Native app: `apps/mobile`. Shared contracts: `packages/shared`.
- Current web foundation: Next.js 16.4.2, React 19, TypeScript, Clerk, Neon/PostgreSQL/pgvector, R2, OpenRouter, optional Redis/NIM. Mobile: Expo SDK 57, React Native 0.86, Clerk Expo.
- API handlers are in `apps/web/src/app/api`; zero-byte `apps/api`/`packages/db` scaffold files were removed from the fresh tree.
- **Active local branch:** `fix/production-readiness-and-app-id`, based on `fa98e09`. Its work is uncommitted and has not been pushed or merged. Review the full diff before committing.
- Latest passing checks: web lint, web typecheck, 375 web tests (18 files), production dependency audit (no known vulnerabilities found), mobile lint, mobile typecheck, `expo install --check`, and `git diff --check`.
- Latest blockers: Android Expo export still cannot resolve `expo-router/entry`; the latest web build fails because `DATABASE_URL` is unset. An earlier Webpack build with a fake DB URL generated 56 pages but was not a real database test.
- Mobile package versions pass Expo's compatibility check, but `apps/mobile/pnpm-workspace.yaml` lacks an active `minimumReleaseAge` value despite comments mentioning a 24-hour quarantine. Native identifiers have changed locally to `com.scholarhub.app` but store/update compatibility is unverified; new Firebase settings, a real HTTPS API origin, EAS/native signing, and device tests remain outstanding. See `docs/CURRENT_STATE.md` for evidence and detail.

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

1. Diagnose Metro's resolver/root behavior for `expo-router/entry`. Do not mask it by changing the app entry to an arbitrary path; make a targeted, evidence-backed fix and rerun Android export.
2. Review and correct the mobile pnpm release-age policy/comments, then rerun install and Expo compatibility checks.
3. Configure a real dedicated staging `DATABASE_URL`, apply migrations with an agreed safe process, and rerun the web production build plus API/browser smoke tests against staging services.
4. Decide whether `com.scholarhub.app` is a new store listing or an update to the former app before release. Supply matching Firebase settings if push is in scope, verify OAuth/deep links, configure signing/EAS, and test a signed internal build on a real device.
5. Add or confirm CI gates and focused E2E/authorization coverage, then audit core applicant journeys and actual scholarship data/import requirements.
6. Finalise approved assets, operator/legal/privacy details, production domain/provider credentials, monitoring/rollback, historical source artifacts, and staged-release approval after the relevant checks pass.

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

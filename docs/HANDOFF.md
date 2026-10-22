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
- **Active branch:** `fix/production-readiness-and-app-id`; PR #2 is open. Published commit `608711a` passed both jobs in [GitHub Actions run 39839441903](https://github.com/itssourov13/scholar-hub/actions/runs/39839441903), including standard Android export on hosted Ubuntu.
- A follow-up is being committed locally: mobile generic credential/generated-file ignore protections are restored; auth role state is keyed to the current Clerk user ID to prevent an old role leaking across account switches; docs/roadmap are updated. Push this follow-up after local verification and inspect its own CI run.
- Current local follow-up: Web lint/typecheck and 379 tests across 19 files pass, including four auth role-state tests. The Webpack production build passed and generated all 56 routes after the auth provider change. The previous published head passed hosted CI, including standard Android export; local export still fails because the ARM64 host has an x86-64 Hermes compiler.
- The intended `com.scholarhub.app` identity is for a separate ScholarHub app listing, not an in-place update of the legacy BairePorbo listing. The store registration and signing path still need verification. No matching Firebase config is committed; push configuration is needed only if push is included. `keystore.properties` is optional for EAS-managed remote signing.
- No migration/import or production DB write occurred. See `docs/CURRENT_STATE.md` for current release gates and honest CI scope.

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
- Follow-up (2026-10-23): root-caused the Android Metro file-map issue using copied package files, aligned Expo SDK package patches/lockfile, and added CI gates. Published head `608711a` passed hosted Web/Mobile CI, including regular Android export. The next local commit restores `.gitignore` safeguards, fixes account-switch role-state handling, and reconciles the current-status docs; it needs a new CI run after push.

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

1. Finish local lint/typecheck/tests/build and diff review, commit this follow-up, then push it. Inspect the new CI run; the previous published head `608711a` already passed both hosted jobs.
2. Configure the real deployed HTTPS API origin for EAS preview/production, produce a signed EAS/native build, and test installation/login/API/core journeys on a physical Android device.
3. Register/verify the separate ScholarHub listing using `com.scholarhub.app`; configure matching Firebase only if push is in scope, retain signing credentials safely, and verify OAuth/deep links.
4. Configure a dedicated staging Neon `DATABASE_URL`, reconcile migrations with backup/rollback, review the actual scholarship source data, and run an approved dry-run import before writing records.
5. Add route/API E2E, two-user authorization, accessibility/performance, and deployment smoke tests; review core applicant journeys and evidence/data requirements.
6. Finalise approved assets, operator/legal/privacy details, production domain/provider credentials, monitoring/rollback, historical source artifacts, and staged-release approval after the appropriate checks pass.

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

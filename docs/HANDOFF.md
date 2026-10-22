# Handoff

_Last updated: 2026-10-22_

## Current objective

Continue adapting the existing application into **ScholarHub**, a broader scholarship discovery and application-management platform. Work in the current workspace; do not create a parallel workspace or greenfield rewrite.

## Exact repository context

- Workspace: `/home/kali/gpt-workspace/BairePorbo`
- Target branch: `main` on the fresh `origin` repository `https://github.com/itssourov13/scholar-hub.git` (local commit only; do not push unless asked).
- Main implementation: `apps/web`
- Native app: `apps/mobile`
- Shared contracts: `packages/shared`
- Current web foundation: Next.js 16, React 19, TypeScript, Clerk, Neon/PostgreSQL/pgvector, R2, OpenRouter, optional Redis/NIM.
- Current mobile foundation: Expo SDK 57, React Native 0.86, Clerk Expo.
- API handlers are in `apps/web/src/app/api`; the zero-byte `apps/api`/`packages/db` scaffold files were removed from the fresh tree.
- Frozen-lockfile installs completed for root, web, and mobile. Web typecheck and 375 tests pass; mobile typecheck passes. Web/mobile lint still report existing issues. Webpack build passed with a fake DB URL, not production credentials. Default Turbopack build fails locally with `Invalid symlink`.
- `expo install --check` reports 22 SDK 57 package mismatches. Android export fails to resolve `expo-router/entry`; a supported upgrade attempt hit pnpm minimum-release-age checks on newly published versions, and the partial upgrade was rolled back. See `docs/CURRENT_STATE.md` for exact results.

## Most recent local preview fix

- Active working branch: `fix/preview-clerk-chunk-cache`. Local commits: `88580cd` (initial Clerk-free preview provider) and `b098d75` (fix middleware handshake, separate Clerk-dependent chunks, clear stale service-worker/cache state). These commits are not pushed or deployed.
- Reproduced the reported problem in a real Chromium headless browser. The homepage HTML returned successfully but Clerk middleware redirected the actual browser to `clerk.scholarhub.local`; the earlier fix had not addressed this server-side handshake. The current opt-in preview mode bypasses Clerk middleware locally and avoids loading the Clerk SDK in public-page bundles.
- Confirmed page rendering and zero Clerk placeholder-host requests in the browser network log; typecheck passed, 375 web tests passed, and the Webpack build completed. That build deliberately used a dummy DB URL and emitted expected Neon errors. It does not confirm real scholarship data or production readiness.
- Local preview server is currently stopped. Do not set `SCHOLARHUB_LOCAL_PREVIEW=1` for Vercel/production; preview auth routes intentionally return to the public homepage.
- When the user asks to push, push `fix/preview-clerk-chunk-cache` so both preview commits are included. Do not push or merge without explicit instruction.

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

## Next steps

1. Resolve the Expo Router Android bundle blocker. Metro currently does not see the local `expo-router/entry.js` in its file map.
2. Revisit the Expo SDK 57 patch alignment once package releases meet the configured minimum-release-age policy; do not broadly disable the supply-chain gate.
3. Fix the existing web/mobile lint errors in a dedicated, targeted quality pass.
4. Configure the actual `DATABASE_URL`, final `NEXT_PUBLIC_SITE_URL`, Clerk/AI/R2/Redis and other enabled provider values in the new deployment; rerun build and runtime smoke tests without dummy values.
5. Review prior source/history privately before deciding whether any credentials require rotation; the new `main` root commit is intended not to carry old history.
6. Finish logo/icon/splash assets, legal/operator details, domain/contact links, native identifiers, Firebase/OAuth/push, signing, and release configuration.
7. Inspect the supplied scholarship ZIP/workbook from its actual available path; build a data dictionary and dry-run importer, then continue with evidence modeling and secure application/offline workflows.

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

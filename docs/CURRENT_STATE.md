# Current State

_Repository audit snapshot: 2026-10-22. Includes the ScholarHub reset and local verification results below; this is not a production credential/deployment smoke test._

## 1. Identity and working tree

- Target product name: **ScholarHub**.
- Existing workspace: `/home/kali/gpt-workspace/BairePorbo`. The workspace path has intentionally not been renamed.
- The brand/documentation changes were prepared on `feat/scholarhub-rebrand-docs`; the deliverable is being committed as a fresh root commit on local `main` for `https://github.com/itssourov13/scholar-hub.git`.
- `README.md` was recreated for ScholarHub and canonical docs now live under `docs/`.
- `origin` is configured to the requested GitHub repository; no branches were returned when checked, so it appeared empty. No push or deploy has been performed.
- Core web/mobile copy and metadata, PWA labels, Expo display name/slug/scheme, shared TypeScript package scope, and service-worker cache namespace use ScholarHub. The former APK and assetlinks file were removed; old store/social/support URLs are configuration-driven or unset, and legacy AdSense/Meta tracking code was disabled. Legacy visual assets, Android/iOS package IDs, Firebase and signing configuration, upload-secret names, and production credentials remain. Privacy/terms/cookie/account-deletion pages are pre-release drafts; the product is not release-ready.

## 2. Repository shape observed

- `apps/web`: current functional web application and API route handlers.
- `apps/mobile`: Expo/React Native application.
- `apps/api`: no active API implementation exists there; its confirmed zero-byte package manifest and empty module file were removed from the deliverable. The active API handlers live in `apps/web/src/app/api`.
- `packages/shared`: shared TypeScript types and typed API client package.
- `packages/db`: its confirmed zero-byte package manifest was removed; database clients currently live in the root/web dependency setup.
- `scripts/`: data/content migration and chat-session remapping scripts.
- Root `package.json`: metadata and a few database-related dependencies; no root scripts.
- No root `pnpm-workspace.yaml` was found. Do not assume root-level workspace orchestration is configured.
- Frozen dependency installs completed for root, web, and mobile using their separate pnpm roots/lockfiles. Results are recorded in Section 7; passing type/tests do not imply release readiness.

## 3. Web stack observed

From `apps/web/package.json`, configuration, source, and migration notes:
- Next.js 16.2.6 App Router, React 19.2.4, TypeScript.
- Clerk authentication; Neon Serverless PostgreSQL (including pgvector); Cloudflare R2-compatible object storage.
- OpenRouter for user-facing chat/embeddings; optional NVIDIA NIM/admin completion flows.
- ioredis-based rate-limiting integration with an in-memory fallback when Redis is not configured.
- CSS Modules and CSS custom properties rather than a utility-first web UI framework.
- Next.js route handlers under `apps/web/src/app/api` implement the current backend API.
- Current deployment references point to Railway and the existing legacy domain configuration; actual production access/deployment was not verified in this audit.

The old root architecture/migration documents contained conflicting historic Supabase/Vercel descriptions. They have been superseded by the current source-based description in [Architecture](ARCHITECTURE.md).

## 4. Mobile stack observed

From `apps/mobile/package.json` and route structure:
- Expo SDK 57, React Native 0.86, Expo Router, TypeScript, NativeWind.
- Clerk Expo authentication and Secure Store integration.
- TanStack Query and a shared typed API client.
- Existing routes include auth, home/discovery, scholarship detail, chat/session history, profile, bookmarks, roadmap, CV, guides, and notifications.

Package name, Android application ID, deep links, API base URL, Firebase configuration, OAuth configuration, and signing/release setup still contain legacy-specific identifiers. These must be handled as a separate migration decision; changing an Android application ID can affect update compatibility and store identity.

## 5. Features observed in source

- Scholarship search/list/detail, published records, official links, related records, AI summaries, eligibility summaries, application tips, and document checklist generation.
- Admin scholarship create/update/archive, parse/scrape, enrich, thumbnail, and RAG ingest workflows.
- AI mentor chat with streaming responses, session/message API, profile context, scholarship retrieval, and rate-limit handling.
- Student profile, dashboard, bookmarks, semantic matching, and personal task CRUD API.
- Personalised study-abroad roadmap and milestone API.
- CV builder and CV analysis/upload flow.
- Educational guides and administration.
- English/Bengali language support.
- PWA manifest/service worker/offline fallback, push-related code, and native mobile client.

These are findings from static code inspection; they do not claim that every route currently builds, every external integration works, or the deployment matches the local tree.

## 6. Current persistence and offline limits

- Scholarship records are stored in the shared PostgreSQL catalogue.
- Personal data uses user identifiers and API-level ownership filters in the existing server handlers. Because the current Neon access path is raw server-side SQL rather than Supabase Auth/RLS clients, every handler must enforce ownership explicitly and consistently.
- The current service worker caches an app shell/offline fallback and leaves API requests network-only. This is not yet a complete offline-first data layer.
- No established application-wide IndexedDB persistence/outbox/sync-conflict implementation was confirmed during the reviewed file sample.
- Scholarship URL parsing exists as an admin workflow; field-level provenance, reviewable source snapshots, and safe automatic change detection remain to be implemented/validated.

## 7. Tests and verification (2026-10-22)

Toolchain: Node.js 22.23.1 and pnpm 11.1.3. Dependency installs completed with frozen lockfiles for the root package, web app, and mobile app. The mobile lockfile had one `expo-image-picker` specifier mismatch; its lockfile importer was corrected from `^57.0.15` to the manifest's `~57.0.15` without changing the resolved package version.

- Web `pnpm typecheck`: PASS.
- Web `pnpm test`: PASS — 18 test files, 375 tests.
- Web `pnpm lint`: FAIL — 28 errors and 10 warnings across the existing codebase; includes React Hooks rules, explicit `any`, purity, and existing JSX/link warnings. These broad pre-existing issues were not mass-fixed in this scoped pass.
- Web production build: `next build` (Turbopack default) failed locally with `TurbopackInternalError: Invalid symlink`. `next build --webpack` compiled, completed TypeScript and generated all 56 static pages, and exited 0 using a deliberately fake local `DATABASE_URL`; expected Neon connection errors were logged while database-backed pages fell back. This is not a production database verification. The app's `build` script now selects Webpack to avoid the observed Turbopack blocker in this workspace.
- Mobile `pnpm typecheck`: PASS after adding an ambient `*.css` declaration for TypeScript 6's side-effect-import checking.
- Mobile `pnpm lint`: FAIL — 7 errors and 3 warnings in existing React Hooks/ref patterns and a small number of warnings. They were not broadly refactored because the task is not a lint cleanup.
- `expo install --check`: reports 22 Expo/React Native packages below the versions expected by the installed SDK 57 toolchain. No bulk dependency upgrade was applied; resolve this before native release and verify on a device/build.
- Mobile Android export: multiple exports failed at Metro resolving `expo-router/entry`, even though `node_modules/expo-router/entry.js` exists. A temporary Metro resolver probe confirmed Metro’s file map reports that entry as not watched; temporary resolver/watch-folder experiments were reverted and no speculative workaround was kept.
- Expo reports 22 native packages below the current SDK 57 compatibility matrix. `expo install --fix` was attempted, but its follow-up install was blocked by pnpm’s 24-hour minimum-release-age supply-chain check for newly published Expo packages; the partial SDK change was rolled back and the existing frozen lockfile reinstalled. Do not disable the age gate merely to force this upgrade; resolve compatibility deliberately before a device release.
- JSON/YAML parsing, changed JavaScript syntax checks, `git diff --check`, and relative Markdown-link checks passed. The two confirmed zero-byte unused scaffold manifests and empty API module were removed rather than committed as invalid package/source files.
- No browser E2E, accessibility/performance audit, real database migration, credentials-backed integration test, or live deployment smoke test was performed.

Do not describe this branch as fully lint-clean or production verified. A real `DATABASE_URL`, final `NEXT_PUBLIC_SITE_URL`, provider configuration, and native release configuration are still required for environment-backed verification. The Android bundle/export is a known unresolved blocker; it should not be hidden by the web build result.

## 8. Sensitive and historical repository files

Historical conversation exports/logs, the generated repository dump, the legacy interview brief, duplicate planning/migration documents, and the local SQL database dump are excluded from the fresh `main` commit. The local legacy feature branch still retains its old Git history; do not push that branch to the new repository. Its historical artifacts have not all been fully audited and may include personal data, conversation content, internal details, or secrets. Before sharing that legacy history, assess whether it must be cleaned and rotate any exposed credentials.

Before publishing this repository or its history to a wider audience:
1. Review those tracked exports and generated dumps.
2. Remove sensitive files from the release and, where required, clean them from Git history.
3. Rotate any exposed credentials.
4. Keep client-provided scholarship/personal ZIP data out of the repository.

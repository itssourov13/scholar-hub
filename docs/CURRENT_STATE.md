# Current State

_Updated: 2026-10-22. Records the local readiness/app-ID branch and its latest checks. This is not a production credential/deployment smoke test._

## 1. Identity and working tree

- Target product name: **ScholarHub**.
- Existing workspace: `/home/kali/gpt-workspace/BairePorbo`. The workspace path has intentionally not been renamed.
- The ScholarHub brand/documentation foundation is in `main` of `https://github.com/itssourov13/scholar-hub.git`.
- `README.md` was recreated for ScholarHub and canonical docs live under `docs/`.
- The Clerk-free local preview fix was merged through PR #1 on 2026-10-22. This confirms a source merge only; production deployment has not been verified.
- Core web/mobile copy and metadata, PWA labels, Expo display name/slug/scheme, shared TypeScript package scope, and service-worker cache namespace use ScholarHub. The former APK and assetlinks file were removed; old store/social/support URLs are configuration-driven or unset, and legacy AdSense/Meta tracking code was disabled. Android/iOS bundle identifiers and upload-property names have been changed locally on the active branch, but store/update compatibility and signing are unverified. Approved visual assets, a matching Firebase configuration, signing credentials, and production credentials remain outstanding. Privacy/terms/cookie/account-deletion pages are pre-release drafts; the product is not release-ready.

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
- Next.js 16.4.2 App Router, React 19.2.4, TypeScript (upgraded on the current local branch).
- Clerk authentication; Neon Serverless PostgreSQL (including pgvector); Cloudflare R2-compatible object storage.
- OpenRouter for user-facing chat/embeddings; optional NVIDIA NIM/admin completion flows.
- ioredis-based rate-limiting integration with an in-memory fallback when Redis is not configured.
- CSS Modules and CSS custom properties rather than a utility-first web UI framework.
- Next.js route handlers under `apps/web/src/app/api` implement the current backend API.
- Current deployment references point to Railway and the existing legacy domain configuration; actual production access/deployment was not verified in this audit.

The old root architecture/migration documents contained conflicting historic Supabase/Vercel descriptions. They have been superseded by the current source-based description in [Architecture](ARCHITECTURE.md).

## 4. Mobile stack observed

From the current local branch configuration and route structure:
- Expo SDK 57, React Native 0.86, Expo Router, TypeScript, NativeWind.
- Clerk Expo authentication and Secure Store integration.
- TanStack Query and the shared typed API client.
- Routes cover auth, home/discovery, scholarship detail, chat/session history, profile, bookmarks, roadmap, CV, guides, and notifications.
- The current local branch sets Android namespace/application ID and iOS bundle identifier to `com.scholarhub.app`. This is not verified against an existing Play Store/App Store listing, signing key, or update path; treat it as a proposed local identity until that decision is made.
- The old Android `google-services.json` was removed because it targets the previous package. A matching new Firebase config has not been provided. The EAS config and environment-driven public API base exist locally but have not been validated in a remote native build or on a device.
- Preview/production EAS profiles require a publicly reachable HTTPS API URL. No real deployed API URL, native signing result, push-notification result, or real-device smoke-test result is recorded for this branch.

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

## 7. Latest verification record (2026-10-23)

**Scope:** local branch `fix/production-readiness-and-app-id`, Node.js 22.23.1, pnpm 11.1.3, Android/Termux on ARM64 with an F2FS filesystem. These results are local working-tree evidence. No changes have been committed, pushed, merged, or deployed.

### Android Metro/Expo Router root cause and local fix

- The original failure was not a missing Expo Router file. Node resolved `expo-router/entry` to `node_modules/expo-router/entry.js`, but Metro's file-map lookup considered it absent.
- Root cause reproduced independently: on this Android/Termux F2FS environment, Node's `fs.readdir(..., { withFileTypes: true })` reported hard-linked regular files as `Dirent.isSymbolicLink() === true`, while `lstat` reported regular files and `readlink` returned `EINVAL`. This happened to ordinary probe files once their hard-link count was greater than one. Metro's crawler skipped those wrongly classified files in `node_modules`, so the Router entry and other packages disappeared from Metro's index.
- Applied the targeted package-manager fix in `apps/mobile/pnpm-workspace.yaml`: `packageImportMethod: copy`. The main mobile dependencies were reinstalled from the updated lockfile with this setting. Re-checks of React, React Native, Expo Router, and Expo Notifications all show link count 1, regular-file `lstat`, and regular-file `Dirent`. The original Metro resolution error no longer reproduces.
- Expo SDK alignment now passes: installed `@expo/cli@57.0.32`, `expo-notifications@57.0.24`, and `pnpm exec expo install --check` reports `Dependencies are up to date`.
- **Diagnostic Android bundle/export:** `pnpm exec expo export --platform android --clear --no-bytecode` exited 0. Metro bundled 2,216 modules, emitted 77 assets, and produced a 4.4 MB Android JS bundle. This command explicitly disables Hermes bytecode and is only a bundling diagnostic, not a release artifact or a substitute for a native/EAS build.
- **Regular Android export on this host:** `pnpm exec expo export --platform android --clear` now resolves and bundles all 2,216 modules, but exits 1 when the Hermes compiler receives `SIGILL`. This host is ARM64 (`aarch64`), while the installed `hermesc` binary is x86-64. This is a host/toolchain execution limit after Metro bundling, distinct from the fixed module-resolution root cause. The new GitHub CI workflow includes the regular export on an Ubuntu runner, but that remote job has not run because the branch has not been pushed.
- Expo Doctor reported 20/20 checks passed and no issues. It did print a non-fatal warning that it could not fetch bundled native modules. Its `appConfigFieldsNotSyncedCheck` is explicitly disabled because the tracked Android project contains manual native configuration; this is not a claim that dynamic Expo config is automatically synchronized. Keep native config changes reviewed against `apps/mobile/android`.

### Checks currently passing

- Web `pnpm lint`: PASS.
- Web `pnpm typecheck`: PASS.
- Web `pnpm test`: PASS — 18 test files, 375 tests.
- Web `pnpm build`: PASS — Next.js Webpack production build completed and generated all 56 static pages/routes using the configured local `.env.local` environment. This does not replace production-like auth, API, or user-journey smoke tests.
- Web production dependency audit (`pnpm audit --prod --audit-level=moderate`): PASS — no known vulnerabilities found in the audited production dependency graph.
- Mobile `pnpm lint`: PASS.
- Mobile `pnpm typecheck`: PASS.
- Mobile `pnpm exec expo install --check`: PASS.
- Mobile `pnpm doctor`: PASS — 20/20 checks passed; the non-fatal native-module-fetch warning is noted above.
- Mobile Android bundling diagnostic with `--no-bytecode`: PASS — 2,216 modules and 77 assets; the normal Hermes bytecode step remains blocked on this ARM64 host as described above.
- Mobile dependency install with `pnpm install --frozen-lockfile`: PASS after refreshing `apps/mobile/pnpm-lock.yaml`. The first offline reinstall lacked the new Notifications tarball, so the final successful frozen install ran online and fetched one package.
- CI workflow and pnpm workspace YAML parse successfully; package JSON files parse; `git diff --check` passes for tracked changes.

### New CI gates

- Added `.github/workflows/ci.yml` for pull requests, pushes to `main`, and manual runs.
- Web job runs frozen install, lint, TypeScript, unit tests, and production build. It uses the repository `DATABASE_URL` secret if configured; otherwise it uses an intentionally unreachable placeholder, which checks build/compile behaviour but does not validate database access.
- Mobile job runs frozen install, lint, TypeScript, Expo SDK check, Expo Doctor, and a normal Android export on the hosted Ubuntu runner.
- The workflow is locally syntax-checked but has **not** been executed by GitHub Actions. Do not report remote CI as green until the first run completes.

### Remaining blockers and limits

- A regular Android export/native build must be verified in a supported runner/EAS environment; the local no-bytecode export is not a shipping build. Review the first CI Android export result and run a signed EAS/internal build before release.
- App identity `com.scholarhub.app` is not verified against an existing Play Store listing or signing/update path.
- A new matching Firebase configuration and push delivery have not been tested. EAS signing, deployed HTTPS API origin, OAuth/deep links, real-device installation/update, and notification smoke tests remain pending.
- No staging migration run, data import/seed, production database write, two-user authorization suite, or credentials-backed integration/E2E test was executed in this pass. The local production build succeeded, but this is not a complete release readiness claim.
- Local changes remain uncommitted and unpushed. The CI file and local-only audit notes have not been published.

**Conclusion:** the original Android Metro resolver failure is fixed locally through package installation strategy, and the diagnostic bundle, Expo checks, web quality gates, and web production build pass. Full release readiness is still blocked on standard Hermes/native build verification outside this ARM64 host and on the separate store, signing, Firebase, staging-data, and real-device gates.

## 8. Sensitive and historical repository files

Historical conversation exports/logs, the generated repository dump, the legacy interview brief, duplicate planning/migration documents, and the local SQL database dump are excluded from the fresh `main` commit. The local legacy feature branch still retains its old Git history; do not push that branch to the new repository. Its historical artifacts have not all been fully audited and may include personal data, conversation content, internal details, or secrets. Before sharing that legacy history, assess whether it must be cleaned and rotate any exposed credentials.

Before publishing this repository or its history to a wider audience:
1. Review those tracked exports and generated dumps.
2. Remove sensitive files from the release and, where required, clean them from Git history.
3. Rotate any exposed credentials.
4. Keep client-provided scholarship/personal ZIP data out of the repository.


## 9. Local visual preview and Clerk handshake fix (2026-10-22)

- The browser-visible failure was traced to a Clerk middleware response: Chromium received `307 Temporary Redirect` to `https://clerk.scholarhub.local/v1/client/handshake` when the Clerk dev-browser handshake cookie was missing. The placeholder `.local` hostname does not resolve on a normal phone/browser.
- The dedicated local visual mode is enabled with `SCHOLARHUB_LOCAL_PREVIEW=1`. In that mode the custom proxy bypasses Clerk middleware for local preview requests, sends `/auth/*` routes to `/?preview=auth-disabled`, and serves public pages through a provider tree that does not load the Clerk client. Clerk-dependent providers and auth hooks are split into separate modules; shared UI imports the context-only `@/lib/auth-context` module.
- In preview mode the browser-side code unregisters previous service workers and clears old `scholarhub-*` caches. The service-worker cache version is now `v6` for a normal app visit.
- Real-browser verification (headless Chromium, 412×915 viewport; also repeated with an Android user agent): the page title and homepage content rendered, the browser did not show a DNS error, and the network log recorded zero requests/redirects to `clerk.scholarhub.local`. HTTP 200 is only a secondary check; it was not accepted as the sole pass criterion.
- `pnpm typecheck` passed; `pnpm test` passed (18 files, 375 tests); `pnpm build` with Webpack passed and generated 56 static pages. The build used a deliberately fake `DATABASE_URL` and logged expected Neon connection errors. No actual database content, production Clerk credentials, or live deployment was verified.
- The preview server was stopped after the user asked to turn it off. The fix (`88580cd`, `b098d75`, plus verification documentation) has since been pushed and merged through PR #1. No production deployment or production configuration was verified.
- Safety: `SCHOLARHUB_LOCAL_PREVIEW` is only for local visual review. Keep it unset in Vercel/production and use real Clerk/database/service configuration there. Login/sign-up are intentionally unavailable in preview mode. A fake local `DATABASE_URL` allows UI/build checks only; it cannot populate the app with real records.

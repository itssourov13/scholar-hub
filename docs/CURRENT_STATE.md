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

## 7. Latest branch verification (2026-10-22)

**Scope:** local branch `fix/production-readiness-and-app-id`, using Node.js 22.23.1 and pnpm 11.1.3. The branch is still uncommitted and has not been pushed, merged, or deployed. These are local results, not production-credential or live-deployment verification.

### Checks currently passing

- Web `pnpm lint`: PASS — ESLint reports no problems; the previous 28-error/10-warning result is superseded for this branch.
- Web `pnpm typecheck`: PASS.
- Web `pnpm test`: PASS — 18 test files, 375 tests.
- Web production dependency audit (`pnpm audit --prod`): PASS — `No known vulnerabilities found` for the audited production dependency graph.
- Mobile `pnpm lint`: PASS — no lint problems; the previous 7-error/3-warning result is superseded for this branch.
- Mobile `pnpm typecheck`: PASS.
- `pnpm exec expo install --check`: PASS — `Dependencies are up to date` against the installed Expo SDK 57 compatibility metadata.
- `git diff --check`: PASS. Frozen-lockfile installs for root, web, and mobile package roots previously completed successfully.

### Known blockers and limits

- **Android export remains blocked.** `EXPO_PUBLIC_API_BASE=http://10.0.2.2:3000 pnpm exec expo export --platform android --clear` still fails in Metro while resolving `./node_modules/expo-router/entry`. The installed `expo-router/entry.js` exists and `require.resolve` can resolve it, but Metro still reports it missing. Simplifying `apps/mobile/metro.config.js` to Expo's default config plus NativeWind did not fix export. This is the principal unresolved build blocker.
- **Web production build is not verified with a real database.** The latest `pnpm build` fails while collecting data for `/api/admin/guides/[id]/cover` because `DATABASE_URL` is not configured. An earlier Webpack build passed with a deliberately fake database URL and generated 56 static pages while logging expected database connection errors. That earlier result only proved part of compile/static generation; it did not verify database integration or production readiness.
- **Release-age policy needs review.** The mobile pnpm configuration has `minimumReleaseAgeExclude` entries and comments referring to a 24-hour quarantine, but the `minimumReleaseAge` setting itself is absent. Those comments do not describe the effective policy accurately. Review and make the intended supply-chain policy explicit, then rerun install and Expo checks; do not assume the quarantine is active.
- **Native app identity is not migration-verified.** Android namespace/application ID and iOS bundle identifier are locally set to `com.scholarhub.app`. Before publication, decide whether this is a new listing or an update to an existing app, then verify store ownership, signing, update compatibility, deep links, and OAuth redirects.
- **Firebase/push configuration is not release-ready.** The old package-specific Android `google-services.json` was removed locally. A new matching Firebase config has not been supplied or tested. Do not claim push notifications are production-ready unless this feature is deferred or configuration is completed.
- **EAS/native signing is unverified.** `apps/mobile/eas.json`, conditional Firebase-config handling, HTTPS API-base checks, and renamed `SCHOLARHUB_UPLOAD_*` properties exist locally. No remote EAS build, signed AAB, installation/update test, or real-device smoke test has run. A deployed HTTPS API URL and correctly configured build/signing credentials are still required.
- No live deployment smoke test, credentials-backed auth test, real database migration/import, two-user authorization test, browser E2E suite, accessibility/performance gate, or signed Android device test has been completed in this phase.

### Local identity/configuration work recorded

- Expo display name/slug/scheme and deep-link scheme use ScholarHub; Android namespace/application ID and iOS bundle identifier are locally set to `com.scholarhub.app`.
- The previous Firebase JSON for the old Android package was deleted from the local worktree; `app.config.js` only attaches a new matching file if one is supplied locally or through the configured environment mechanism.
- `EXPO_PUBLIC_API_BASE` no longer uses a production localhost fallback; EAS preview/production profiles require a public HTTPS API URL.
- EAS build configuration was added, but its actual remote/native build result is unknown.

**Conclusion:** local quality has substantially improved: web/mobile lint and typecheck, all 375 web tests, the Expo package check, and the production dependency audit pass. The repository is **not yet production/release-ready** because Android export remains blocked, the latest web build lacks `DATABASE_URL`, and native store identity/Firebase/signing/real-service smoke tests remain unverified.

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

# Current State

_Updated: 2026-10-23. Records merged EAS/Vercel preparation, the active catalogue-import branch, and the staging-only data setup. This is not a production credential/deployment smoke test._

## 1. Identity and working tree

- Target product name: **ScholarHub**.
- Existing workspace: `/home/kali/gpt-workspace/BairePorbo`. The workspace path has intentionally not been renamed.
- The ScholarHub brand/documentation foundation is in `main` of `https://github.com/itssourov13/scholar-hub.git`.
- `README.md` was recreated for ScholarHub and canonical docs live under `docs/`.
- The Clerk-free local preview fix was merged through PR #1 on 2026-10-22. This confirms a source merge only; production deployment has not been verified.
- Core web/mobile copy and metadata, PWA labels, Expo display name/slug/scheme, shared TypeScript package scope, and service-worker cache namespace use ScholarHub. The former APK and assetlinks file were removed; old store/social/support URLs are configuration-driven or unset, and legacy AdSense/Meta tracking code was disabled. Android/iOS identifiers are set to `com.scholarhub.app`, but store/update compatibility and signing are unverified. As of 2026-10-23, the matching Android Firebase config is validated locally and uploaded to the linked EAS project's Preview/Production environments as a secret File variable. A matching backend FCM service-account JSON has also been validated and stored outside Git, with its Base64 value configured in the Git-ignored local web .env.local. The user confirmed the Firebase service account has the `Firebase Cloud Messaging API Admin` role in Google Cloud; FCM API enablement, production host configuration, signing and real-device tests remain outstanding. Privacy/terms/cookie/account-deletion pages are pre-release drafts; the product is not release-ready.

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
- The web app is prepared for Vercel with explicit Next.js, frozen Corepack/pnpm install/build commands, the daily push-digest cron, and the Singapore Function region `sin1`. Import the repo with Root Directory `apps/web`, Node.js 22.x, source files outside the root enabled for `packages/shared`, `ENABLE_EXPERIMENTAL_COREPACK=1`, and the environment variables listed in [Vercel Deployment](VERCEL_DEPLOYMENT.md). No ScholarHub project is visible in the connected Vercel scope; production URL, env variables, hosted build and live smoke tests remain unverified. The Neon project is selected, but its production schema remains empty until approved migration.

The old root architecture/migration documents contained conflicting historic Supabase/Vercel descriptions. They have been superseded by the current source-based description in [Architecture](ARCHITECTURE.md).

## 4. Mobile stack observed

From the current local branch configuration and route structure:
- Expo SDK 57, React Native 0.86, Expo Router, TypeScript, NativeWind.
- Clerk Expo authentication and Secure Store integration.
- TanStack Query and the shared typed API client.
- Routes cover auth, home/discovery, scholarship detail, chat/session history, profile, bookmarks, roadmap, CV, guides, and notifications.
- The branch sets Android namespace/application ID and iOS bundle identifier to `com.scholarhub.app`. The current product intent is a separate ScholarHub app identity, not an in-place update of the legacy BairePorbo listing. Verify that this identifier is registered/available for the intended new listing in the relevant store console before release; store registration and signing have not been verified.
- The old Android `google-services.json` was removed because it targeted the previous package. A new matching file has since been registered/downloaded/validated for `com.scholarhub.app`, kept out of Git, and uploaded to EAS as the secret file variable `GOOGLE_SERVICES_JSON` for Preview and Production.
- The Expo app is linked to EAS project `@skking13s-team/scholarhub` (ID `698f4a91-f440-4caa-9a03-26cb04b8dfa0`); the team owner and project ID are recorded in local `apps/mobile/app.json`. The app config resolves the expected package and local Firebase path.
- Local backend FCM credential setup is complete: the downloaded service-account JSON was validated for project scholarhub-itssourov13, moved to $HOME/.config/scholarhub/fcm-service-account.json with owner-only file permissions, and its Base64 JSON value was written to apps/web/.env.local. The value is round-trip validated and .env.local is Git-ignored; secret content was not printed. The user confirmed the FCM IAM role in Google Cloud Console; API enablement was not verified from this terminal because gcloud is unavailable, and no real-device delivery was attempted. A unique local CRON_SECRET is also configured in the Git-ignored .env.local, but it is not configured on any hosting provider. The production host remains unconfirmed; configure the same server-only secret there after the correct host project is connected. Keep the private key out of Git and the mobile app.
- `keystore.properties` is optional local signing configuration. The current EAS setup can use remote EAS-managed signing credentials, so do not create/commit local keystore properties just to satisfy the repository. EAS signing, production HTTPS API origin, Clerk/OAuth/deep links, and device behaviour still require actual build/runtime validation.
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

## 7. Earlier verification record (2026-10-23; before catalogue-import work)

**Historical scope:** local branch `fix/production-readiness-and-app-id`, Node.js 22.23.1, pnpm 11.1.3, Android/Termux on ARM64 with an F2FS filesystem. These results precede the later scholarship catalogue import; see Section 10 for the active branch and newest local verification. Published head `608711ae1a27cc1875b493bd31aad47ece86ff2e` passed both jobs in [GitHub Actions run 39839441903](https://github.com/itssourov13/scholar-hub/actions/runs/39839441903). The mobile ignore/auth-role changes are present in subsequent mainline history at merge `4d95ed1`. No database migration/import or production deployment was performed during that earlier pass.

### Android Metro/Expo Router root cause and local fix

- The original failure was not a missing Expo Router file. Node resolved `expo-router/entry` to `node_modules/expo-router/entry.js`, but Metro's file-map lookup considered it absent.
- Root cause reproduced independently: on this Android/Termux F2FS environment, Node's `fs.readdir(..., { withFileTypes: true })` reported hard-linked regular files as `Dirent.isSymbolicLink() === true`, while `lstat` reported regular files and `readlink` returned `EINVAL`. This happened to ordinary probe files once their hard-link count was greater than one. Metro's crawler skipped those wrongly classified files in `node_modules`, so the Router entry and other packages disappeared from Metro's index.
- Applied the targeted package-manager fix in `apps/mobile/pnpm-workspace.yaml`: `packageImportMethod: copy`. The main mobile dependencies were reinstalled from the updated lockfile with this setting. Re-checks of React, React Native, Expo Router, and Expo Notifications all show link count 1, regular-file `lstat`, and regular-file `Dirent`. The original Metro resolution error no longer reproduces.
- Expo SDK alignment now passes: installed `@expo/cli@57.0.32`, `expo-notifications@57.0.24`, and `pnpm exec expo install --check` reports `Dependencies are up to date`.
- **Diagnostic Android bundle/export:** `pnpm exec expo export --platform android --clear --no-bytecode` exited 0. Metro bundled 2,216 modules, emitted 77 assets, and produced a 4.4 MB Android JS bundle. This command explicitly disables Hermes bytecode and is only a bundling diagnostic, not a release artifact or a substitute for a native/EAS build.
- **Regular Android export on this host:** `pnpm exec expo export --platform android --clear` resolves/bundles all 2,216 modules, but exits 1 at Hermes with `SIGILL` because this ARM64 host has an x86-64 `hermesc` binary. This is a local host/toolchain mismatch after Metro bundling, not the original resolver failure. The regular export subsequently passed on hosted Ubuntu in GitHub Actions run [39839441903](https://github.com/itssourov13/scholar-hub/actions/runs/39839441903). This does not replace an EAS signed build or real-device smoke test.
- Expo Doctor reported 20/20 checks passed and no issues. It did print a non-fatal warning that it could not fetch bundled native modules. Its `appConfigFieldsNotSyncedCheck` is explicitly disabled because the tracked Android project contains manual native configuration; this is not a claim that dynamic Expo config is automatically synchronized. Keep native config changes reviewed against `apps/mobile/android`.

### Checks recorded for that earlier verification pass

- Web `pnpm lint`: PASS.
- Web `pnpm typecheck`: PASS.
- Historical prior-branch Web `pnpm test`: PASS — 19 files, 379 tests, including four auth role-state tests. The newer catalogue-import branch passed 21 files / 388 tests; see Section 10.
- Web `pnpm build`: PASS — Next.js Webpack production build completed and generated all 56 static pages/routes using the configured local `.env.local` environment. This does not replace production-like auth, API, or user-journey smoke tests.
- Web production dependency audit (`pnpm audit --prod --audit-level=moderate`): PASS — no known vulnerabilities found in the audited production dependency graph.
- Mobile `pnpm lint`: PASS.
- Mobile `pnpm typecheck`: PASS.
- Mobile `pnpm exec expo install --check`: PASS.
- Mobile `pnpm doctor`: PASS — 20/20 checks passed; the non-fatal native-module-fetch warning is noted above.
- Mobile Android bundling diagnostic with `--no-bytecode`: PASS — 2,216 modules and 77 assets; the normal Hermes bytecode step remains blocked on this ARM64 host as described above.
- Mobile dependency install with `pnpm install --frozen-lockfile`: PASS after refreshing `apps/mobile/pnpm-lock.yaml`. The first offline reinstall lacked the new Notifications tarball, so the final successful frozen install ran online and fetched one package.
- CI workflow and pnpm workspace YAML parse successfully; package JSON files parse; `git diff --check` passes for tracked changes.

### Hosted CI status for the earlier published commit

- `.github/workflows/ci.yml` runs on pull requests, pushes to `main`, and manual dispatch.
- GitHub Actions run [39839441903](https://github.com/itssourov13/scholar-hub/actions/runs/39839441903) completed successfully for published head `608711ae1a27cc1875b493bd31aad47ece86ff2e`: Web job (frozen install, lint, typecheck, 375 tests, build) and Mobile job (frozen install, lint, typecheck, Expo SDK check, Doctor, standard Android export) both passed.
- If repository secret `DATABASE_URL` is absent, Web CI uses an intentionally unreachable placeholder. The build job verifies compile/static build behaviour, not database connectivity, migrations, real scholarship data, or authenticated API journeys.
- Run 39839441903 certifies the earlier published commit only. The later active `feat/scholarship-catalogue-import` branch has separate local checks documented in Section 10; the older green run does not certify it. Its PR-specific CI must be inspected after the branch is pushed and a pull request is opened or updated.

### Blockers and limits recorded at that earlier checkpoint

- The normal Android export passed in hosted Ubuntu CI. The local ARM64/Termux failure is specific to the x86-64 Hermes compiler installed on that host. A real EAS/native signed build and installation on a physical device are still required before release.
- The intended app identity is a separate ScholarHub listing using `com.scholarhub.app`, not an update of the legacy BairePorbo listing. Confirm the new listing/package registration and retain the EAS/Play signing credentials safely.
- Matching Firebase configuration and push delivery remain untested if push is part of the release. `google-services.json` is intentionally absent from Git; `keystore.properties` is optional when EAS remote signing is used.
- No staging migration, source-catalogue dry run/import, production database write, two-user authorization suite, or credentials-backed integration/E2E test was run during that earlier pass. Section 10 records the later staging-only migration/import; production writes and credentials-backed integration/E2E remain unverified.
- The mobile ignore/auth-role follow-up was later incorporated into the mainline history. The active catalogue-import branch is a separate feature branch and must receive its own PR CI run.

**Conclusion for that earlier checkpoint:** Metro resolution was fixed and standard Android export was verified on hosted Ubuntu. Web/Mobile CI passed for the then-published head. The later catalogue-import branch and its staging results are described in Section 10. Production database target/schema, scholarship-source verification, enforced admin publish gating, authorization/E2E, signing, and real-device release gates remain open.

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

## 10. Latest merged catalogue import and production-region implementation (2026-10-23)

- PR #4, `feat: add safe scholarship catalogue import`, is merged into `main` at `33e88e0a46ad22d84053cc91a382c910b6df1341`. The working branch for the current production database/region task is `audit/production-neon-target`, created from the updated `origin/main`.
- The primary audience is Bangladesh. The selected database project is Neon **ScholarHub Production Singapore** (`shy-darkness-67521294`, `aws-ap-southeast-1`). Vercel Function region is now explicitly set to `sin1` in `apps/web/vercel.json` to keep DB-backed server code in Singapore; this has not yet been validated by a hosted Vercel deployment.
- Production branch `br-divine-grass-a16og13f` currently has **zero public application tables**. Staging branch `br-nameless-fog-a10fo0rl` has 14 public tables, 94 scholarship rows (all draft/unverified), zero published/live rows, and zero `ScholarshipDoc` rows. Both local environment files still point to staging, so do not reuse either local `DATABASE_URL` value for Vercel Production.
- The separate US-East Neon project `calm-poetry-87067538` has an empty production branch and is not selected. Vercel tool discovery returned no ScholarHub project in the currently connected Vercel account/scope and `scholar-hub` lookup returned not found; no Vercel env vars were changed and no deployment was triggered.
- Created isolated Neon preflight branch `br-holy-cell-a1qlrlmy` from the intended Singapore production branch and applied the schema baseline (`018` through `028`) there only. Smoke checks verified 14 tables, the five expected scholarship columns, pgvector, the RAG matching function, and zero scholarship/RAG rows. Schema comparison with staging shows only a column-order difference for `slug`; no production migration or catalogue copy has occurred.
- Current branch verification on Node 22.23.1 / pnpm 11.1.3 passed lint, typecheck, all 388 tests across 21 files, and the Webpack build (56 static pages/routes); `git diff --check`, `vercel.json` JSON validation and Markdown local-link checks passed. Build emitted the existing non-blocking custom Cache-Control warning for `/_next/static/:path*`. Current changes have not yet run hosted branch CI.
- Production schema creation remains an approval-gated operation. Follow `docs/PRODUCTION_DATABASE.md` for branch evidence and the migration runbook; keep the temporary preflight branch until the migration decision is completed.
- The imported 94 scholarship records remain unverified staging drafts, and the other 215 candidate rows remain held for review. Official current-cycle source validation, admin publish gating, RAG ingestion, credentials-backed auth/authorization checks, hosted CI/deployment, EAS signing, and physical-device validation are still open. Local-only `audit.md` and `report.md` remain ignored by Git.

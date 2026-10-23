# Changelog

Meaningful product and engineering changes are recorded here. Dates use YYYY-MM-DD. This log does not replace Git history.

## Unreleased

### 2026-10-23 — Choose Singapore Neon production target and preflight schema
- Confirmed Neon region `aws-ap-southeast-1` (Singapore) for the Bangladesh-first audience and set Vercel Functions `regions` to `sin1` in `apps/web/vercel.json`. Static assets remain global CDN-served; runtime latency still requires deployed measurement.
- Selected Neon project `ScholarHub Production Singapore` (`shy-darkness-67521294`) and its production branch `br-divine-grass-a16og13f`. The current local `DATABASE_URL` resolves to the separate staging branch; it is not a production configuration.
- Audited the Singapore production branch, staging branch, and the empty US-East alternative. Created isolated preflight branch `br-holy-cell-a1qlrlmy`, applied baseline migrations `018`–`028` there, and verified 14 public tables, pgvector/RAG function, required scholarship columns, and zero scholarship data. Production remains untouched.
- Added `docs/PRODUCTION_DATABASE.md` with an evidence matrix and explicit production migration runbook. A Vercel project is not available in the connected account scope, so environment variables/deploy were not changed. Applying schema to production remains an explicit-approval gate.

### 2026-10-23 — Controlled scholarship catalogue import to Neon staging
- Added `028_scholarship_import_provenance.sql` for the existing `required_documents` cache field, source identity/provenance timestamps, verification state, and idempotent review indexes. Applied and verified only on the configured staging branch.
- Added conservative data assessment/mapping for `cleaned_scholarships.json`, six focused import-helper tests, and an idempotent importer that is read-only by default and hard-guards write mode to an explicitly allowlisted staging host.
- Dry-run classified 94 unique records for import and held 215 back for human review. Imported 94 records as drafts with `is_live=false` and `source_verification_status='unverified'`; no record was published and no RAG embeddings were generated.
- Fixed the public scholarships endpoint so `?status=draft`/`?status=archived` cannot bypass the published-only boundary, and added three regression tests.
- Added `docs/SCHOLARSHIP_DATA_IMPORT.md` and refreshed project docs. Root `.gitignore` now excludes both `/audit.md` and `/report.md`; both reports are local-only.
- At the time of that catalogue-import checkpoint, the intended production Neon project/branch had not yet been selected; no production branch or Vercel deployment was modified. Final local verification on Node 22.23.1 passed lint, typecheck, 388 tests across 21 files, the Webpack production build (56 static pages/routes), `git diff --check`, and local-report ignore checks. The build emitted a non-blocking Cache-Control warning for `/_next/static/:path*`.
### 2026-10-23 — Prepare Vercel deployment configuration
- Added the official Vercel JSON schema and declared the Next.js framework in `apps/web/vercel.json`.
- Pinned Vercel's install/build commands to the web app's `packageManager` via Corepack and `--frozen-lockfile`, avoiding accidental lockfile drift.
- Preserved the daily `/api/cron/push-digest` schedule at 03:00 UTC (09:00 Dhaka); confirmed the handler checks `CRON_SECRET` and declares `maxDuration = 60`.
- Added `docs/VERCEL_DEPLOYMENT.md` and linked it from the README; it documents Root Directory, Node 22, shared-source inclusion, Corepack, environment variables and smoke-test steps for the user's separate Vercel account.
- No Vercel project has been linked, no environment variables were uploaded to Vercel, and no deployment was triggered.

### 2026-10-23 — Configure local backend FCM service-account secret
- Validated the downloaded Google service-account JSON against project scholarhub-itssourov13 and required private-key fields without printing credential contents.
- Moved the JSON from the repository root to $HOME/.config/scholarhub/fcm-service-account.json, restricted the containing directory and file permissions, and confirmed the original file is no longer in the repository.
- Set FCM_SERVICE_ACCOUNT in Git-ignored apps/web/.env.local as Base64 JSON; round-trip validation passed and the existing environment content was preserved.
- Refreshed the push utility's explanatory comment so it no longer claims there is no EAS project; runtime delivery logic was not changed.
- Generated a unique local CRON_SECRET because none existed, without printing its value. Hosting-side FCM_SERVICE_ACCOUNT and CRON_SECRET still require configuration once the production host is confirmed.
- The user confirmed the service account's `Firebase Cloud Messaging API Admin` role in Google Cloud Console. The FCM API enabled state could not be checked from this terminal because gcloud is unavailable. No push message was sent; production hosting, real-device token registration/delivery, and deployment remain unverified.

### 2026-10-23 — Link EAS team project and configure Firebase Android file
- Linked the Expo app to `@skking13s-team/scholarhub` (EAS project ID `698f4a91-f440-4caa-9a03-26cb04b8dfa0`) and recorded the owner/project ID in `apps/mobile/app.json`.
- Downloaded and validated the Firebase config for Android package `com.scholarhub.app`; retained the file locally under `.gitignore` rather than committing it.
- Uploaded `GOOGLE_SERVICES_JSON` to EAS as a secret File variable assigned to both Preview and Production; EAS environment listing confirms file type and secret visibility.
- This config does not configure backend FCM sending. `FCM_SERVICE_ACCOUNT`, confirmed hosting target, real mobile API/Clerk environment values, EAS signing, signed build, and real-device notification test remain release gates. No deployment was performed.

### 2026-10-23 — Mobile ignore safeguards, role-state isolation, and current CI/docs status
- Restored generic mobile ignore protections for local signing/certificate formats, `.env*.local`, Metro health-check files, package-manager debug logs, macOS metadata and patch leftovers, while retaining explicit ScholarHub Firebase/signing/build-output paths. These are Git-safety rules, not local-preview requirements; EAS-managed signing does not require local `keystore.properties`.
- Fixed a possible account-switch race in the web auth provider: role state is now tied to the user ID it was fetched for, and a different user's role stays null/loading until their profile role resolves. Added focused tests for user switching, same-user role, signed-out and auth-loading states. Server-side authorization remains independently required.
- Reconciled README, current state, task state, handoff, architecture, decisions, security/privacy and roadmap against hosted CI run [39839441903](https://github.com/itssourov13/scholar-hub/actions/runs/39839441903), which passed both jobs on published head `608711a`. This records that earlier checkpoint; its CI result is not evidence for the later catalogue-import branch.
- Documented `com.scholarhub.app` as the intended separate ScholarHub identity, Firebase registration only if push is in scope, and optional local signing configuration. At that earlier checkpoint, Web lint/typecheck, 379 tests across 19 files, and the Webpack production build (56 routes) passed locally. Its hosted CI evidence applies to the then-published head only. No Firebase credentials, keystore, database migration/import, production write or deployment was added/performed during that phase.

### 2026-10-23 — Android Metro root-cause fix, dependency alignment, CI gates, and verification
- Traced the Android Metro `expo-router/entry` resolution failure to Android/Termux F2FS/Node Dirent metadata: hard-linked regular files were returned as symlinks by `readdir`, so Metro's file map skipped package files. Configured `packageImportMethod: copy` for the mobile pnpm root and freshly reinstalled dependencies; inspected package files to confirm link count 1 and regular-file metadata.
- Aligned `@expo/cli` to `57.0.32` and `expo-notifications` to `57.0.24`, updated `apps/mobile/pnpm-lock.yaml`, and confirmed `expo install --check` passes. Enabled the existing 24-hour `minimumReleaseAge` policy explicitly as already present in the working mobile pnpm config and added exact exceptions for those SDK-required patches.
- Added `.github/workflows/ci.yml` for web lint/typecheck/tests/build and mobile lint/typecheck/Expo SDK check/Doctor/Android export. The workflow is locally YAML-validated but has not yet run on GitHub.
- Verified web lint, typecheck, all 375 tests, production build (56 static pages/routes, using the configured local environment), and production dependency audit (no known vulnerabilities); mobile lint/typecheck, Expo SDK check, and Expo Doctor (20/20 checks) also pass.
- Verified the Android JS/assets bundle on the main project with `expo export --platform android --clear --no-bytecode` (2,216 modules, 77 assets). Standard export bundles modules successfully but the local ARM64 host cannot execute the installed x86-64 Hermes compiler (`SIGILL`); hosted Ubuntu CI must confirm the normal bytecode export.
- Updated current state, task state, handoff, roadmap, decisions, README, and the local-only `audit.md`. No schema migration, seed/import, commit, push, merge, or production deployment was performed.


### 2026-10-22 — Local production-readiness/app-ID progress and status refresh
- Recorded latest local checks: web lint/typecheck pass, all 375 web tests pass, production dependency audit reports no known vulnerabilities, mobile lint/typecheck pass, Expo SDK package check passes, and `git diff --check` passes.
- Updated Current State, Task State, Handoff, README, and the editable production roadmap to distinguish passing quality gates from remaining release blockers.
- Recorded that Android Metro export still cannot resolve `expo-router/entry` and the latest web production build fails without a real `DATABASE_URL`; an earlier fake-database Webpack build is not production verification.
- Recorded local Android/iOS identifier changes to `com.scholarhub.app`, removal of the old package-specific Firebase JSON, and unverified EAS/API/signing/store-compatibility work.
- Flagged the mismatch between mobile pnpm comments about a 24-hour release-age quarantine and the currently absent `minimumReleaseAge` setting.
- This entry describes local working-tree evidence only: branch changes remain uncommitted/unpushed/unmerged and no production deployment, database, or credentials were changed during this documentation-only refresh.


### 2026-10-22 — Temporary editable production roadmap
- Added `docs/PRODUCTION_ROADMAP.md` as a proposed, changeable plan for stabilising the web/mobile build pipeline, staging real scholarship data, completing core applicant journeys, strengthening security/offline handling, and staged web/Android release.
- Explicitly documented that phases and tasks may be added, removed, reordered, split, combined, or deferred after review; the draft is not a locked specification or proof of completed functionality.
- Linked the draft from the root README, project context, task state, and handoff.
- Corrected stale documentation that still described PR #1 as unpushed; the preview fix is merged, but production deployment remains unverified.

### 2026-10-22 — Local preview Clerk handshake fix and real-browser verification
- Root cause confirmed in Chromium network logs: Clerk middleware returned an HTTP 307 to `https://clerk.scholarhub.local/v1/client/handshake` when the local dev-browser handshake cookie was missing. A successful HTML/HTTP 200 response alone had not proved the browser could render the page.
- Updated `apps/web/src/proxy.ts` so the explicitly enabled `SCHOLARHUB_LOCAL_PREVIEW=1` mode bypasses Clerk middleware and redirects `/auth/*` to the public homepage. The flag must remain unset outside a trusted local preview; this mode is not an authentication mode and must not be deployed.
- Split Clerk-dependent providers and the Clerk-backed auth implementation from the shared auth context. The initial public-page JavaScript bundle no longer requests the placeholder Clerk host.
- Added a preview-only service-worker cleanup path: unregister existing workers and clear old `scholarhub-*` caches. Bumped the normal service-worker cache version from `v5` to `v6` so stale shell content is not reused on the next regular visit.
- Verified with headless Chromium at a mobile-sized viewport and an Android user agent: the ScholarHub homepage rendered, the title/content were present, the browser showed no DNS error, and the recorded browser network log had zero requests/redirects to the placeholder Clerk host. Auth-route redirects were separately observed going to `/?preview=auth-disabled`.
- Verification: `pnpm typecheck` passed; `pnpm test` passed (18 files, 375 tests); `pnpm build` using Webpack exited 0 and generated 56 static pages with a deliberately fake local database URL. Expected Neon errors were logged because that URL is not a real database; this does not verify real content, credentials, or production integration.
- Local preview server was stopped after the user's request. Changes are committed locally on `fix/preview-clerk-chunk-cache` as `b098d75`; the preceding preview-only provider change is `88580cd`. No push, deployment, production environment, or database was changed.

### 2026-10-22 — Verification and fresh-repository safety
- Installed root, web, and mobile dependencies using frozen lockfiles; corrected the mobile lockfile's existing `expo-image-picker` specifier mismatch without changing its resolved version.
- Fixed the guide-detail `BASE` constant scope error found by web typecheck; added the TypeScript 6 ambient CSS declaration required by the NativeWind global stylesheet import.
- Changed the web production build script to use Webpack after the default Turbopack build failed locally with `Invalid symlink`; Webpack compilation, typecheck, static page generation, and build tracing completed with only a fake local database URL (not production verification).
- Changed the R2 CORS helper to use `NEXT_PUBLIC_SITE_URL` instead of old-brand live origins and to tolerate a missing `.env.local`; its dry run passed with a fake test domain and made no R2 changes.
- Removed the implicit legacy Railway destination from the scheduled push-digest workflow; a new repository must explicitly configure `CRON_TARGET_URL` before the job will send a request.
- Added root ignore rules for local `.env` values and the tracked database dump; removed zero-byte unused `apps/api`/`packages/db` scaffold manifests and the empty API module. The fresh initial commit will exclude prior Git history, private SQL data, and removed conversation exports.
- Verification: web typecheck passed and 375/375 web tests passed; mobile typecheck passed. Lint still fails on existing rule violations in both apps, and Expo reports SDK package-version mismatches. Repeated Android exports fail because Metro cannot resolve `expo-router/entry`; pnpm refused the immediate Expo SDK patch alignment under its minimum-release-age check, so the partial upgrade was rolled back rather than bypassing the supply-chain gate.


### 2026-10-21 — ScholarHub identity and documentation foundation
- Established ScholarHub as the target product name in the project documentation.
- Rewrote the root README and added root agent instructions.
- Added canonical project context, current state, architecture, decision log, task state, handoff, and security/privacy documentation.
- Replaced the generic web-app README and refreshed the web-specific agent instructions.
- Retired obsolete duplicate root plans/migration notes and the old interview brief after consolidating relevant requirements and engineering context.
- Changed primary product-name strings in web/mobile UI, site metadata/schema labels, PWA manifest labels, native display labels, and the shared TypeScript package scope to ScholarHub.
- Bumped the service-worker cache namespace/version to avoid reusing the old app shell cache.
- Kept legacy logo/icon/splash assets, Android/iOS application IDs, Firebase settings, upload-signing details, and deployment credentials pending a safe migration plan.
- Made website base URL, support/social links, Telegram target, and Play Store redirect configurable/unset by default; changed mobile API examples to local development endpoints.
- Removed the old downloadable APK and assetlinks file; disabled the previous hard-coded AdSense and Meta Pixel integrations.
- Removed generated repository snapshots and historical conversation-log exports from the current tree; historical Git objects have not been scrubbed.
- Replaced former-operator About/Contact details and marked unfinished Privacy/Terms/Cookies/Account Deletion pages as explicit pre-release drafts.
- Recorded that legal/operator finalisation, new brand artwork/native IDs, data import, dependency baseline, and release preparation remain pending.
- Identified tracked historical exports and repository dumps as items to review before any public source release.
- No database schema, production data, deployment, or environment credentials were changed. Product copy, footer links, consent/analytics source code, legal pages, and native/app configuration were changed locally.

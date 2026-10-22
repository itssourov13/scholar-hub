# Changelog

Meaningful product and engineering changes are recorded here. Dates use YYYY-MM-DD. This log does not replace Git history.

## Unreleased

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

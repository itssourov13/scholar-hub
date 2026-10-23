# Task State

_Last reviewed: 2026-10-23 — PR #3 merged; active local branch `feat/scholarship-catalogue-import`; 94 unverified drafts imported to Neon staging._

## Current phase

The ScholarHub documentation/brand foundation, Clerk-free local visual-preview fix, and Firebase/EAS/Vercel preparation are merged into `main`; PR #3's published head is merge `4d95ed1` and GitHub Actions run [39854247770](https://github.com/itssourov13/scholar-hub/actions/runs/39854247770) passed. The active branch is `feat/scholarship-catalogue-import`. It adds a dry-run-first importer, an additive provenance/document-cache migration, and a public endpoint fix preventing status query parameters from revealing drafts. The configured Neon staging branch now contains 94 draft/unverified candidates; production was not modified. See `docs/SCHOLARSHIP_DATA_IMPORT.md` and the local-only `report.md`. The project is not release-ready: canonical production DB target/schema, official record verification, admin publish gating, authorization/E2E, new listing, EAS signing, conditional Firebase/push, public API deployment, legal/operator and device checks remain outstanding.

The editable [Production Roadmap (Draft)](PRODUCTION_ROADMAP.md) remains the planning source of truth. Legacy brand artwork, legal/operator details, real service configuration, verified scholarship data, security testing, and release configuration still require work. Policy pages remain pre-release drafts.

## Completed in the static audit and documentation reset

- [x] Inspected the repository tree and the starting Git status.
- [x] Confirmed the web app is in `apps/web`, the mobile app is in `apps/mobile`, and the current API handlers live in the Next.js app.
- [x] Identified the current source-level stack: Next.js/React/TypeScript, Clerk, Neon/PostgreSQL/pgvector, R2, OpenRouter, and Expo/React Native.
- [x] Identified current feature areas: scholarship catalogue/admin, AI mentor/RAG, profile/dashboard/bookmarks/tasks API, roadmap, CV builder/analyser, guides, language support, PWA shell, and mobile routes.
- [x] Identified key gaps: no confirmed full offline data layer; source evidence/change detection incomplete; application tracker is not yet a full scholarship-linked workflow; brand/config references remain; root workspace/install setup needs validation.
- [x] Created a focused documentation branch in the existing workspace.
- [x] Rebuilt the root README around ScholarHub.
- [x] Added root agent/contributor instructions.
- [x] Added canonical project context, current state, architecture, decision log, task state, changelog, handoff, and security/privacy documents under `docs/`.
- [x] Replaced the generic `apps/web/README.md` and refreshed `apps/web/AGENTS.md`.
- [x] Removed obsolete duplicate root plans/migration notes and the old interview brief after consolidating their relevant product/technical context.
- [x] Documented that legacy visual assets/native integration identifiers, build/test baseline, import tooling, and public-release cleanup are still pending.

## Completed: local visual-preview handshake fix (2026-10-22)

- [x] Reproduced the `clerk.scholarhub.local` failure in Chromium network logs and identified Clerk middleware's dev-browser handshake redirect as the cause; HTTP 200 alone was insufficient verification.
- [x] Added a strictly opt-in `SCHOLARHUB_LOCAL_PREVIEW=1` branch in the proxy, redirected preview auth pages to the public homepage, and split Clerk-dependent modules from the shared auth context so public preview JS does not load the placeholder Clerk SDK host.
- [x] Added preview-only cleanup of old service-worker registrations and `scholarhub-*` caches; bumped the regular cache version to `v6`.
- [x] Verified the rendered page with Chromium at 412×915 and with an Android user agent; zero placeholder Clerk handshake/DNS events were recorded.
- [x] Re-ran web TypeScript and tests (375/375 pass) and rebuilt with Webpack (56 static pages generated). This used a dummy `DATABASE_URL` and is not a real database/production integration test.
- [x] Stopped the local preview server after the user requested shutdown. The preview fix was pushed and merged through PR #1; it has not been verified in a production deployment.

**Still outstanding for real content:** configure a real Neon `DATABASE_URL`, apply/reconcile the versioned migrations against a dedicated database, inspect and safely import the actual scholarship catalogue, confirm records are `published`, and test `/api/scholarships` and the rendered list against the real dataset. pgvector extensions, `ScholarshipDoc` documents, and embeddings are additionally needed for RAG/semantic matching; they are not required just to render ordinary published scholarship rows. Do not use the preview's dummy DB URL as a production or data-import target.

## Previously identified brand/repository and product tasks

### P0 — Repository and release safety
- [x] Remove historical conversation exports/logs and the generated repository dump from the current working tree so they are not part of the ScholarHub source tree.
- [ ] Review their historical Git versions for private data/secrets before any public source release; clean repository history and rotate credentials if exposure is found.
- [x] Inspect package-manager/workspace setup and frozen lockfiles; install root, web, and mobile dependencies. The root and each app are separate pnpm roots, not a single pnpm workspace.
- [x] Capture actual lint, typecheck, unit-test, build, and dependency-audit outcomes, including failures and environment limitations. Web/mobile lint cleanup is passing on the current local branch; credentials-backed build verification remains pending.
- [ ] Complete the remaining source/asset/integration inventory, including legal/operator copy, domains, native identifiers, release credentials, and legacy public artifacts.

### P1 — Brand and integration inventory
- [x] Replace primary user-facing brand copy, page-title/Open Graph labels, organization/site schema name, PWA labels, Expo display name/slug/scheme, Android deep-link scheme, and shared TypeScript package scope with ScholarHub.
- [x] Removed the old prebuilt APK and assetlinks file so they are not served as ScholarHub assets.
- [ ] Replace legacy logo/favicon/OG/splash/launcher artwork with approved ScholarHub assets.
- [x] Replaced former-operator About/Contact copy and marked Privacy, Terms, Cookies, and Delete Account pages as pre-release drafts.
- [ ] Finalise legal policies with the actual operator, enabled data processors, target markets, contact address, retention rules, and deletion behaviour.
- [ ] Decide the domain, support identity, hosting environment, app links, analytics/ads ownership, and release ownership. Former hard-coded ad/pixel integrations are disabled until this is decided.
- [x] The PR branch sets Android namespace/application ID and iOS bundle identifier to `com.scholarhub.app`; this is configuration only and has not been released to an app store.
- [x] Record intent to use `com.scholarhub.app` for a separate ScholarHub listing rather than updating the legacy BairePorbo listing. Verify the new package registration and signing ownership in the relevant store console before release.
- [x] Repoint service-worker cache namespace/version to ScholarHub, update native deep-link scheme, and make store/support/social/Telegram destinations configurable rather than tied to the old product.
- [ ] Supply/test Firebase config matching the new package if push notifications are in scope; inventory OAuth, CDN paths, signing, and remaining deployment URLs.
- [ ] Keep existing production environment and credentials isolated until the migration plan is verified.

## Backlog — Requirements and data model
- [ ] Build a data dictionary from the actual client workbook: sheet names, headers, rows, identifiers, dates, links, enums, and import rules.
- [ ] Define core records: institutions, programmes/intakes, opportunities, funding components, eligibility rules, sources/evidence, and change events.
- [ ] Define private records: profiles/preferences, saved opportunities, applications/status history, tasks, requirements, document metadata/versions, and essays.
- [ ] Add validation and duplicate/conflict reports to a dry-run import script.
- [ ] Use a staging database/environment; never import client-private data into a public demo.

## Backlog — Core product
- [ ] Map existing catalogue/search/detail/profile/dashboard functionality against ScholarHub user journeys.
- [ ] Finish application lifecycle, linked checklists/tasks, personal deadline overrides, and calendar UX.
- [ ] Add funding-component modelling and transparent coverage/out-of-pocket comparisons.
- [ ] Add local IndexedDB persistence for selected offline-supported workflows and test reload/offline operations.
- [ ] Add reliable JSON/CSV export and restore validation.
- [ ] Evaluate a first-run walkthrough, accessible password visibility toggle, in-app feedback, and store discoverability metadata from previous user feedback.

## Backlog — Research and verification
- [ ] Complete the source/evidence model with explicit evidence references, field-level provenance, and intake applicability. Record-level source identity, verification status, and timestamps have been introduced for the import workflow, but a complete evidence/review UI is not yet in place.
- [ ] Harden URL import for SSRF, timeouts, response-size limits, redirects, content types, and rate limits.
- [ ] Add a human-review queue for extracted or changed material facts.
- [ ] Add snapshots/diffs, retries, stale-source status, and approved-update history.
- [ ] Ensure failed fetches never mark opportunities closed.

## Backlog — Multi-user and release readiness
- [ ] Add two-user authorization/integration tests for every private-data domain.
- [ ] Define sync outbox/idempotency/revision conflict handling before enabling cross-device sync.
- [ ] Define private document storage and deletion/export behaviour before cloud upload is available.
- [ ] Add accessibility/performance gates, route-level E2E tests, focused security checks, and deployment smoke tests; current CI covers lint, typecheck, unit tests, build, and Expo export only.
- [ ] Create sanitized demo data, portfolio case study, setup guide, and release checklist.

## Acceptance criteria for the documentation and product-label reset

- [x] Root `README.md` identifies ScholarHub and maps to canonical docs.
- [x] Root `AGENTS.md` defines scope, source-of-truth rules, privacy constraints, workflow, and verification expectations.
- [x] All requested docs exist: `PROJECT_CONTEXT.md`, `CURRENT_STATE.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `TASK_STATE.md`, `CHANGELOG.md`, and `HANDOFF.md`.
- [x] A security/privacy document was added because client documents and broader public usage require explicit safeguards.
- [x] Historical duplicate/stale root docs were retired or replaced with canonical pointers.
- [x] Documentation distinguishes current implementation, planned work, and unverified behaviour.
- [x] No database schema, production data, deployment, or environment credentials were changed. Product copy/metadata, app labels, footer links, consent/analytics source code, legal pages, and native/app configuration changed locally.

## Historical verification record — mobile/role-state pass before catalogue import (2026-10-23)

This section preserves the earlier mobile/role-state verification snapshot. Its “not yet verified” items describe that earlier checkpoint, not the later catalogue-import branch. Current import and production-target status is documented in the latest implementation pass below.

### Checks recorded as passing during that earlier phase

- [x] Web lint and TypeScript checks.
- [x] Historical prior-branch Web unit-test result: 19 files, 379 tests; four tests cover user-switch, same-user, signed-out and auth-loading role state. The newer catalogue-import branch passed 21 files / 388 tests; see the latest implementation pass below.
- [x] Web production build with the configured local `.env.local` environment; 56 static pages/routes generated.
- [x] Web production dependency audit: `pnpm audit --prod --audit-level=moderate` reports no known vulnerabilities.
- [x] Mobile lint and TypeScript checks.
- [x] SDK package alignment: `pnpm exec expo install --check` reports dependencies are up to date; the installed CLI is `57.0.32` and Notifications is `57.0.24`.
- [x] Expo Doctor: 20/20 checks passed and no issues detected; a non-fatal network warning prevented fetching bundled native-module metadata.
- [x] Android Metro/Router resolution failure reproduced and root-caused to Node/F2FS Dirent metadata misreporting hard-linked regular package files as symbolic links. Adding `packageImportMethod: copy`, then doing a fresh mobile install, makes the relevant dependency files appear as regular files with link count 1.
- [x] Diagnostic Android bundle/export: `pnpm exec expo export --platform android --clear --no-bytecode` exited 0 with 2,216 modules and 77 assets.
- [x] Mobile frozen-lockfile install; the refreshed mobile lockfile now matches `expo-notifications@57.0.24` and `@expo/cli@57.0.32`.
- [x] CI workflow/YAML and package JSON syntax checks; `git diff --check` passed.

### Items still blocking or not verified at that historical checkpoint

- [x] Standard Android export smoke test on hosted Ubuntu passed in GitHub Actions run [39839441903](https://github.com/itssourov13/scholar-hub/actions/runs/39839441903). The local ARM64 host still cannot run its x86-64 Hermes compiler (`SIGILL`); this is an environment-specific local limitation.
- [ ] Complete an EAS/native signed build, install it on a physical Android device, and test app start, login, real API connectivity, critical journeys and the intended new-listing install path.
- [ ] Confirm/register `com.scholarhub.app` as the intended separate ScholarHub app listing in the relevant store console. The product intent is not to update the legacy BairePorbo listing; package registration and signing ownership still require verification.
- [ ] Supply/test Firebase config matching `com.scholarhub.app` if push remains in scope.
- [ ] Configure a public HTTPS API origin for EAS preview/production, verify EAS secrets/signing and OAuth/deep links, and test push delivery if enabled.
- Historical note: staging migration/import had not yet occurred at that earlier checkpoint. The later catalogue-import pass applied migration 028 and imported 94 draft/unverified records to the configured Neon staging branch only; production was not modified. Production schema reconciliation and official-source review remain open.
- [ ] Complete credentials-backed auth, two-user authorization, route/API E2E, accessibility/performance, and deployment smoke tests.
- [ ] Review historical Git artifacts before wider source release; rotate any exposed credentials if evidence of exposure is found.

### CI status at that historical checkpoint

- [x] Added `.github/workflows/ci.yml` for PRs, pushes to `main`, and manual dispatch.
- [x] Web job runs frozen install, lint, typecheck, unit tests, and build. Without the `DATABASE_URL` repository secret, the build uses an intentionally unreachable placeholder: compilation only, not DB integration.
- [x] Mobile job runs frozen install, lint, typecheck, Expo SDK validation, Expo Doctor, and normal Android export on hosted Ubuntu.
- [x] GitHub-hosted run [39839441903](https://github.com/itssourov13/scholar-hub/actions/runs/39839441903) passed for published commit `608711a` (both jobs).
- [x] That earlier mobile/role-state follow-up is present in the subsequent mainline history. Its successful CI run does not cover the newer catalogue-import branch; after pushing the active feature branch, open/update a PR and inspect the branch-specific CI run.

**Conclusion for that earlier pass:** the Metro file-map issue was fixed, and standard Android export passed on hosted Ubuntu. That pass restored mobile ignore protections and account-switch role-state derivation; lint, typecheck and 379 tests passed at that point. The later catalogue-import branch passed 388 Web tests locally. Its hosted CI, production database target/schema, official-source review, enforced admin publish gate, two-user authorization/E2E, EAS signing, and device/release checks remain open.

## Editable production roadmap

- [x] Added the temporary draft in [Production Roadmap](PRODUCTION_ROADMAP.md), including phased goals and exit criteria for both web and mobile.
- [ ] Review and adjust phase/task scope with the user before treating any proposed item as committed work. Tasks may be added, removed, reordered, deferred, or split.

## Latest implementation pass — scholarship catalogue import (2026-10-23)

- [x] Created isolated branch `feat/scholarship-catalogue-import` from the latest `origin/main` (PR #3 merge `4d95ed1`).
- [x] Added additive migration 028 for required-document caching and source provenance/review state.
- [x] Added conservative source-data assessment/mapping and a read-only-by-default, staging-host-allowlisted importer with deterministic source IDs.
- [x] Initial staging import completed: 94 draft/unverified rows inserted; 0 per-row write errors; 0 records published; 215 rows held for manual review.
- [x] Second read-only run confirms idempotence: 94 source records already imported, 0 new import candidates.
- [x] Fixed public scholarships route to always filter on `status='published'`; added three regression cases for query parameters.
- [x] Added import helper mapping/duplicate tests (6/6) and public API exposure regression tests (3/3) pass.
- [x] Final Web verification on Node 22.23.1 / pnpm 11.1.3: lint, typecheck, all 388 tests in 21 files, Webpack build (56 static pages/routes), `git diff --check`, and report-ignore checks passed.
- [ ] Confirm canonical production Neon project/branch and reconcile production schema separately; do not copy staging rows into production before schema/record review.
- [ ] Manually review current-cycle facts on official sources; 94 drafts are not publication-ready.

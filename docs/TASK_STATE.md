# Task State

_Last reviewed: 2026-10-22 — latest local production-readiness/app-ID branch status_

## Current phase

The ScholarHub documentation/brand foundation and the Clerk-free local visual-preview fix are merged into `main`. A separate local branch, `fix/production-readiness-and-app-id`, has substantially improved quality checks but remains uncommitted and not pushed/merged. Web/mobile lint and typecheck, 375 web tests, the web production dependency audit, Expo package compatibility check, and `git diff --check` pass. This is not a production-readiness claim: Android export is still blocked, the latest web build lacks `DATABASE_URL`, and Firebase/native signing/store identity/real-service tests remain outstanding.

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
- [x] Local branch sets Android namespace/application ID and iOS bundle identifier to `com.scholarhub.app`; this is a configuration change only and has not been published.
- [ ] Decide whether this should be a new store listing or an update to an existing listing; verify signing ownership and update compatibility before release.
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
- [ ] Add typed source records, evidence references, verification state, checked timestamps, and intake applicability.
- [ ] Harden URL import for SSRF, timeouts, response-size limits, redirects, content types, and rate limits.
- [ ] Add a human-review queue for extracted or changed material facts.
- [ ] Add snapshots/diffs, retries, stale-source status, and approved-update history.
- [ ] Ensure failed fetches never mark opportunities closed.

## Backlog — Multi-user and release readiness
- [ ] Add two-user authorization/integration tests for every private-data domain.
- [ ] Define sync outbox/idempotency/revision conflict handling before enabling cross-device sync.
- [ ] Define private document storage and deletion/export behaviour before cloud upload is available.
- [ ] Add accessibility and performance CI gates, route-level E2E tests, security checks, and deployment smoke tests.
- [ ] Create sanitized demo data, portfolio case study, setup guide, and release checklist.

## Acceptance criteria for the documentation and product-label reset

- [x] Root `README.md` identifies ScholarHub and maps to canonical docs.
- [x] Root `AGENTS.md` defines scope, source-of-truth rules, privacy constraints, workflow, and verification expectations.
- [x] All requested docs exist: `PROJECT_CONTEXT.md`, `CURRENT_STATE.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `TASK_STATE.md`, `CHANGELOG.md`, and `HANDOFF.md`.
- [x] A security/privacy document was added because client documents and broader public usage require explicit safeguards.
- [x] Historical duplicate/stale root docs were retired or replaced with canonical pointers.
- [x] Documentation distinguishes current implementation, planned work, and unverified behaviour.
- [x] No database schema, production data, deployment, or environment credentials were changed. Product copy/metadata, app labels, footer links, consent/analytics source code, legal pages, and native/app configuration changed locally.

## Latest verification record and remaining gates (2026-10-22)

### Passing on `fix/production-readiness-and-app-id`
- [x] Web lint passes with no ESLint problems (the prior 28-error/10-warning result is superseded for this branch).
- [x] Web typecheck passes.
- [x] Web tests pass: 18 files, 375 tests.
- [x] Web production dependency audit reports `No known vulnerabilities found`.
- [x] Mobile lint passes with no lint problems (the prior 7-error/3-warning result is superseded for this branch).
- [x] Mobile typecheck passes.
- [x] `pnpm exec expo install --check` reports `Dependencies are up to date` for the installed SDK compatibility matrix.
- [x] `git diff --check` passes; earlier JSON/YAML parsing, changed JavaScript syntax, frozen-lockfile install, and relative Markdown-link checks passed.

### Still blocking or unverified
- [ ] Resolve Android Metro export: bundling still fails to resolve `./node_modules/expo-router/entry` although the package's `entry.js` exists. Simplifying Metro config did not solve it.
- [ ] Configure a real dedicated staging `DATABASE_URL`; rerun `pnpm build` and route/runtime smoke tests. Latest build fails at `/api/admin/guides/[id]/cover` for missing configuration; the earlier Webpack build using a fake URL was not a database integration test.
- [ ] Review mobile release-age policy: `apps/mobile/pnpm-workspace.yaml` has `minimumReleaseAgeExclude` entries and 24-hour-quarantine comments but no active `minimumReleaseAge` value. Make the intended policy explicit and verify it.
- [ ] Confirm whether `com.scholarhub.app` is a new app identity or an update to an existing listing; verify signing ownership and update path.
- [ ] Supply new Firebase config matching `com.scholarhub.app` if push is in release scope; the previous package-specific JSON is removed locally.
- [ ] Set the actual deployed HTTPS API origin for EAS preview/production, configure secrets/signing, and complete an EAS/native build, signed AAB installation/update test, and real-device smoke test.
- [ ] Test Clerk auth/callbacks/OAuth and private API ownership against staging credentials with at least two users. This pass did not run production-like authorization tests.
- [ ] Confirm CI gates; run browser E2E/accessibility/performance tests, migration/import validation, backup/rollback checks, and deployment smoke tests.
- [ ] Finalise production domain, provider credentials, approved brand assets, legal/operator/privacy details, analytics/ads ownership, monitoring/support, and staged-release decisions.
- [ ] Review historical Git artifacts before wider source release; rotate exposed credentials if evidence of exposure is found.

**State:** lint/test/typecheck/dependency-audit baseline is substantially improved; release readiness is still blocked by Android export and missing real database configuration, with native and operational verification pending. All branch changes remain local and uncommitted.

## Editable production roadmap

- [x] Added the temporary draft in [Production Roadmap](PRODUCTION_ROADMAP.md), including phased goals and exit criteria for both web and mobile.
- [ ] Review and adjust phase/task scope with the user before treating any proposed item as committed work. Tasks may be added, removed, reordered, deferred, or split.

# Task State

_Last reviewed: 2026-10-22_

## Current phase

**Phase 0 — ScholarHub documentation/brand reset and baseline verification.**

The documentation/brand work is being prepared as a fresh root commit on `main` for the empty `itssourov13/scholar-hub` repository. Canonical documentation and primary product labels now use ScholarHub. Legacy brand artwork, native application IDs/Firebase/signing, operator details, and release configuration remain pending; policy pages are draft notices, not final legal terms.

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
- [x] Stopped the local preview server after the user requested shutdown. The preview fixes are committed locally on `fix/preview-clerk-chunk-cache` (`b098d75`); not pushed or deployed.

**Still outstanding for real content:** configure a real Neon `DATABASE_URL`, apply/reconcile the versioned migrations against a dedicated database, inspect and safely import the actual scholarship catalogue, confirm records are `published`, and test `/api/scholarships` and the rendered list against the real dataset. pgvector extensions, `ScholarshipDoc` documents, and embeddings are additionally needed for RAG/semantic matching; they are not required just to render ordinary published scholarship rows. Do not use the preview's dummy DB URL as a production or data-import target.

## Phase 0 — remaining tasks

### P0 — Repository and release safety
- [x] Remove historical conversation exports/logs and the generated repository dump from the current working tree so they are not part of the ScholarHub source tree.
- [ ] Review their historical Git versions for private data/secrets before any public source release; clean repository history and rotate credentials if exposure is found.
- [x] Inspect package-manager/workspace setup and frozen lockfiles; install root, web, and mobile dependencies. The root and each app are separate pnpm roots, not a single pnpm workspace.
- [x] Capture actual lint, typecheck, unit-test, and build outcomes, including failures and environment limitations; full lint cleanup and credentials-backed build verification remain pending.
- [ ] Complete the remaining source/asset/integration inventory, including legal/operator copy, domains, native identifiers, release credentials, and legacy public artifacts.

### P1 — Brand and integration inventory
- [x] Replace primary user-facing brand copy, page-title/Open Graph labels, organization/site schema name, PWA manifest labels, Expo display name/slug/scheme, Android deep-link scheme, and shared TypeScript package scope with ScholarHub.
- [x] Removed the old prebuilt APK and assetlinks file so they are not served as ScholarHub assets.
- [ ] Replace legacy logo/favicon/OG/splash/launcher artwork with approved ScholarHub assets.
- [x] Replaced former-operator About/Contact copy and marked Privacy, Terms, Cookies, and Delete Account pages as pre-release drafts.
- [ ] Finalise all legal policies with the actual operator, enabled data processors, target markets, contact address, retention rules, and deletion behaviour before public release.
- [ ] Decide the new domain, support identity, logo/icon set, hosting environment, app links, analytics/ads ownership, and release ownership. Former hard-coded ad/pixel integrations are disabled until this is decided.
- [ ] Decide whether a new Android application ID is required. Do not change it casually because it can affect app-store identity and update compatibility.
- [x] Repoint service-worker cache namespace/version to ScholarHub, update native deep-link scheme, and make store/support/social/Telegram destinations configurable rather than tied to the old product.
- [ ] Inventory OAuth, push notifications, CDN paths, signing, native application IDs, Firebase project settings, and remaining deployment URLs.
- [ ] Keep the existing production environment and credentials isolated until the migration plan is verified.

## Phase 1 — Requirements and data model
- [ ] Build a data dictionary from the actual client workbook: sheet names, headers, rows, identifiers, dates, links, enums, and import rules.
- [ ] Define core records: institutions, programmes/intakes, opportunities, funding components, eligibility rules, sources/evidence, and change events.
- [ ] Define private records: profiles/preferences, saved opportunities, applications/status history, tasks, requirements, document metadata/versions, and essays.
- [ ] Add validation and duplicate/conflict reports to a dry-run import script.
- [ ] Use a staging database/environment; never import client-private data into a public demo.

## Phase 2 — Core product
- [ ] Map existing catalogue/search/detail/profile/dashboard functionality against ScholarHub user journeys.
- [ ] Finish application lifecycle, linked checklists/tasks, personal deadline overrides, and calendar UX.
- [ ] Add funding-component modelling and transparent coverage/out-of-pocket comparisons.
- [ ] Add local IndexedDB persistence for selected offline-supported workflows and test reload/offline operations.
- [ ] Add reliable JSON/CSV export and restore validation.
- [ ] Evaluate a first-run walkthrough, accessible password visibility toggle, in-app feedback, and store discoverability metadata from previous user feedback.

## Phase 3 — Research and verification
- [ ] Add typed source records, evidence references, verification state, checked timestamps, and intake applicability.
- [ ] Harden URL import for SSRF, timeouts, response-size limits, redirects, content types, and rate limits.
- [ ] Add a human-review queue for extracted or changed material facts.
- [ ] Add snapshots/diffs, retries, stale-source status, and approved-update history.
- [ ] Ensure failed fetches never mark opportunities closed.

## Phase 4 — Multi-user and release readiness
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

## Verification record and remaining gates (2026-10-22)

- [x] `git diff --check` passed.
- [x] The working tree and diff were reviewed; a new-repository commit must contain a fresh root history and must not carry legacy database/log-export history.
- [x] Retired root docs are absent and 18 relative Markdown links across the reviewed docs resolve.
- [x] JSON/YAML and changed JavaScript syntax checks passed after removing the zero-byte unused scaffold files.
- [x] Root, web, and mobile frozen-lockfile installs completed; web typecheck passed; 375 web tests passed; mobile typecheck passed.
- [ ] Web/mobile lint are not clean (28 web errors + 10 warnings; 7 mobile errors + 3 warnings). Avoid unrelated mass refactors; fix them in a dedicated quality pass.
- [x] Attempted Android export repeatedly; Metro cannot resolve `expo-router/entry` and its file map reports the installed entry as not watched. Temporary resolver/watch-folder diagnostics were removed.
- [ ] Resolve the Expo SDK 57 package-version mismatch and Android bundle blocker. The supported `expo install --fix` path encountered pnpm minimum-release-age blocks for very recently published packages; the partial SDK change was rolled back rather than bypassing the supply-chain age gate.
- [ ] Run the final `pnpm build` using the configured real database/service environment and verify runtime routes. The local Webpack build passed with a dummy DB URL but logged expected database connection failures; default Turbopack failed with an invalid-symlink error.
- [ ] Finalise production domain, actual provider credentials, native application identifiers, Firebase/OAuth/push, signing, legal/operator details, and release configuration before deployment.

# ScholarHub Production Roadmap (Draft)

_Status: temporary planning draft — 2026-10-23. This is an editable proposal, not a locked specification, promise, or release date._

## Purpose and target

Prepare the existing ScholarHub codebase to operate as **two production clients backed by one product platform**:

- **Web:** the Next.js application in `apps/web`, including the API route handlers already used by the clients.
- **Mobile:** the Expo/React Native app in `apps/mobile` (Android is the initial native release target; iOS scope can be added or deferred).
- **Shared platform:** the existing server-side API, Neon/PostgreSQL data store, Clerk identity, and configured storage/AI/notification services.

The web and mobile clients should use the same account and authorised server-side data. A bookmark, saved opportunity, or application update should appear across clients when that feature is implemented with shared persistence and verified. Do not assume all current routes and integrations already meet this goal; audit and test them.

This plan deliberately evolves the current codebase. It does **not** prescribe a rewrite, microservices, a new database, every proposed feature, or an unconditional commitment to release every platform.

## How to maintain this roadmap

This roadmap is expected to change as the project is audited and product priorities become clearer.

1. Tasks may be **added, removed, split, combined, reordered, deferred, or moved between phases**. Do not implement an item simply because it appears here.
2. Keep task IDs where practical (for example `P1.2`) so reviews and notes can refer to a task. When items are removed, update this document and, when the reason matters, record a one-line note in the changelog or decision log.
3. Use these statuses: `Proposed`, `In progress`, `Blocked`, `Done`, `Deferred`, or `Removed`. Change a status only after checking the actual repository/runtime evidence; documentation does not prove implementation.
4. Before starting a phase, re-check current code, issues, external service availability, and user priorities. The ordering below is a suggested dependency order; phases may run partly in parallel when safe.
5. Each implementation change should use a focused branch, explicit acceptance criteria, relevant tests, and a reviewable diff. Do not push, merge, deploy, change production data, or alter credentials without the user's explicit approval.
6. Keep confirmed implementation, outstanding work, assumptions, and externally blocked work distinct. If an item no longer supports the product goal, remove it instead of preserving it for completeness.

## Proposed phases

The roadmap scope remains a **Proposed**, editable plan; individual task checkboxes below reflect the latest local evidence where marked. A checked local lint item does not mean the whole phase or product is production-ready.

### Phase 1 — Stabilise the repository and build pipeline

**Goal:** establish a reproducible baseline for both clients before adding more product complexity.

- [x] `P1.1` Pin/use the supported Node.js 22 range (`>=22 <23`) consistently for local work and CI via `.nvmrc` and the CI workflow.
- [x] `P1.2` Expo SDK 57 alignment passes `expo install --check`; the mobile pnpm root has an explicit 24-hour `minimumReleaseAge` setting plus exact exceptions for the SDK-required CLI/Notifications patches.
- [x] `P1.3` Fixed the reproduced Metro file-map failure by using pnpm copied package files on Android/Termux F2FS. Diagnostic export passes 2,216 modules/77 assets; regular Android export passed on hosted Ubuntu in [run 39839441903](https://github.com/itssourov13/scholar-hub/actions/runs/39839441903). The local ARM64 host's x86-64 Hermes compiler still causes `SIGILL`; EAS/native signing and device checks remain separate release gates.
- [x] `P1.4` Resolve the observed web/mobile lint errors in focused groups; current-branch lint passes for both apps.
- [x] `P1.5` Added `.github/workflows/ci.yml` for Web lint/typecheck/tests/build and Mobile lint/typecheck/Expo compatibility/Doctor/standard Android export. Run 39839441903 passed both jobs for published head `608711a`; the current local ignore/auth/docs follow-up must be pushed and its own run checked.
- [ ] `P1.6` Add/confirm essential smoke tests for public web routes, core API routes, and a mobile build connected to a test API.
- [x] `P1.7` Document separate install/check commands because root, web, and mobile use separate pnpm roots and lockfiles.

**Exit criteria:** a clean, reproducible install and builds for the web and intended mobile target; required checks report honestly; known blockers are either fixed or explicitly accepted with a reason. A dummy database build alone does not pass the real-service release gate.

### Phase 2 — Establish real staging data and content ingestion

**Goal:** show accurate, testable scholarship content from a controlled database before touching production data.

- [ ] `P2.1` Set up or verify a dedicated Neon staging database and the required server-only connection configuration.
- [ ] `P2.2` Review the existing versioned migrations against the current schema; apply them to staging with a recorded result and rollback/restore plan.
- [ ] `P2.3` Inspect the actual supplied workbook/archive only when it is available at a confirmed path. Build a data dictionary and dry-run report before writing records.
- [ ] `P2.4` Create/verify a repeatable importer with deduplication, validation, error reporting, and a safe way to rerun it.
- [ ] `P2.5` Preserve official source URLs, evidence, verification status/time, intake applicability, and conflicts for material fields such as eligibility, funding, deadlines, and application links.
- [ ] `P2.6` Test the scholarship APIs and rendered web/mobile screens against staged records; verify the publication filter and expected empty/error states.
- [ ] `P2.7` Configure and validate pgvector/documents/embeddings only for the RAG or semantic-matching workflows that actually require them.

**Exit criteria:** staging data can be rebuilt/reconciled, import discrepancies are reviewable, and published scholarship records display from the real staging database. No personal applicant documents are committed to Git or imported into a public demo.

### Phase 3 — Complete and verify the core product journeys

**Goal:** turn the existing catalogue and user tools into coherent workflows instead of treating individual routes as proof of a complete product.

- [ ] `P3.1` Audit existing discovery/detail/profile/dashboard/bookmark/AI mentor/roadmap/CV/guides features against the intended journeys. Reuse working implementations rather than rebuild them by default.
- [ ] `P3.2` Complete search and filtering for relevant dimensions such as country, university/programme, degree, subject, intake, nationality/eligibility, funding, requirements, fees, and deadline.
- [ ] `P3.3` Make eligibility explanations distinguish `eligible`, `ineligible`, and `unknown/needs review`; keep data uncertainty visible and do not present match scores as admission probabilities.
- [ ] `P3.4` Represent tuition, stipend/living costs, accommodation, travel, insurance, fees, conditions, and unknown funding components separately before claiming an award is fully funded.
- [ ] `P3.5` Complete the scholarship-linked application lifecycle, status history, user-specific deadlines, checklists/tasks, reminders/calendar, notes, and document-version metadata to the agreed scope.
- [ ] `P3.6` Verify parity for the agreed core journeys across web and mobile; record which features are intentionally web-only or deferred.
- [ ] `P3.7` Add functional/E2E tests and accessible empty, loading, offline, and failure states for the selected core journeys.

**Exit criteria:** an applicant can discover an opportunity, understand evidence and funding, save it, manage its application, and access the same authorised data on both clients for every journey declared in scope.

### Phase 4 — Secure personal data and make offline behaviour reliable

**Goal:** ensure private work belongs to the right user and offline limitations are clear and recoverable.

- [ ] `P4.1` Audit every private/admin API operation for server-derived identity, record ownership, role checks, and ownership-scoped reads/updates/deletes.
- [ ] `P4.2` Add two-user integration tests that attempt cross-user read, change, and delete operations, including altered record IDs.
- [ ] `P4.3` Define private-document storage, upload limits/type checks, access authorisation, signed URL lifetime, deletion, and export before enabling private cloud uploads.
- [ ] `P4.4` Harden URL import/AI workflows for SSRF, redirects, DNS/private-address checks, timeouts, response-size limits, rate limits, source rules, and human review.
- [ ] `P4.5` Define which records/actions must work offline; add local persistence, visible sync status, and local backup/export/restore for that scope.
- [ ] `P4.6` Before cross-device sync, specify an outbox, idempotency, revision tracking, retry, and user-resolvable conflict behaviour; never silently discard edits.
- [ ] `P4.7` Finalise account export/deletion semantics, retention, privacy wording, operator/contact details, and enabled data processors.
- [ ] `P4.8` Add appropriate dependency/secret/security checks and accessibility/performance checks; review historical repository artifacts privately before public source release.

**Exit criteria:** critical authorisation cases are tested; private data handling and deletion/export are documented and verified for the enabled scope; offline/sync limits are explicit; no unreviewed source or AI claims are presented as verified facts.

### Phase 5 — Release web and Android app through staged rollout

**Goal:** deploy production web and publish the mobile app only after the release-specific gates pass.

- [ ] `P5.1` Decide the production domain, hosting/deployment target, support identity, analytics/ads ownership, monitoring, and rollback process.
- [ ] `P5.2` Keep staging and production environment variables/secrets separate. Configure the real production database and only the Clerk, AI, R2, Redis, email, webhook, and other services that are actually enabled.
- [ ] `P5.3` Keep `SCHOLARHUB_LOCAL_PREVIEW` unset in Vercel/production. Verify normal Clerk middleware, production auth, callbacks, OAuth, webhooks, and mobile redirects using test accounts.
- [ ] `P5.4` Register/verify the separate ScholarHub listing using `com.scholarhub.app`; confirm package registration/availability and signing ownership in the Play Console before publishing. Do not treat this as an in-place update to the legacy BairePorbo listing.
- [ ] `P5.5` Finalise approved logo/favicon/social/open-graph/launcher/adaptive/splash assets, app links/deep links, Firebase/push settings, signing and EAS release configuration.
- [ ] `P5.6` Set the mobile production API base to the deployed HTTPS API (not `localhost`), build a signed Android App Bundle, and test installation/update, login, API access, notifications if enabled, and critical journeys on real devices.
- [ ] `P5.7` Complete the web production build and browser/device smoke tests against production-like services; verify migrations, auth/authorisation, errors, logs, rate limits, performance, and recovery procedures.
- [ ] `P5.8` Finalise privacy/terms/cookies/account deletion and operational contact information for the real operator and target markets.
- [ ] `P5.9` Release to a limited/internal audience first; check crash/error/usage signals and data correctness before a wider rollout. Add iOS release steps only if that platform is in the approved scope.

**Exit criteria:** the production web deployment and signed mobile release use the intended environment and shared backend; critical user/security journeys pass; policy, monitoring, backup/rollback, signing, and release ownership are verified. A successful local build is not sufficient evidence for this gate.

## Decisions to keep open

These are intentionally unresolved until the related phase is reviewed:

- The intent is to publish ScholarHub as a separate app using `com.scholarhub.app`, not update the legacy BairePorbo listing. Confirm package registration/availability and signing ownership in the store console before release; do not publish until verified.
- Final web hosting/domain, operator/support identity, legal-policy details, analytics/ads, and rollout timing.
- Which product features must be offline-first and whether cross-device sync is necessary for the first release.
- Whether iOS is in the first release scope or deferred.
- Which advanced catalogue/research/AI features justify implementation after the core applicant journey works.

## Current verified baseline (updated 2026-10-23; not a release claim)

- The web application and API handlers live in `apps/web`; `apps/mobile` is the separate Expo/React Native client.
- On the active `feat/scholarship-catalogue-import` branch, Web lint and typecheck passed, all 388 tests across 21 files passed, and the Webpack production build generated 56 static pages/routes. `git diff --check` and the repeat read-only import dry-run also passed. The build emitted a non-blocking Cache-Control warning for `/_next/static/:path*`. These local checks do not replace hosted CI, credentials-backed integration, or browser/device smoke tests.
- A controlled run applied additive migration 028 and imported 94 scholarship candidates into the configured Neon staging branch as `draft`, `is_live=false`, and `source_verification_status='unverified'`. A repeat dry-run found all 94 source identities already imported and zero new candidates, confirming rerun idempotence. No records were published, no RAG embeddings were created, and no production branch was modified. The other 215 source rows remain held for manual review.
- The local import analysis classified 166 rows as missing an official link, 81 as missing a country required by the current schema, and 14 as belonging to duplicate-URL groups; these reason counts can overlap. The URLs and material scholarship facts have not been verified against official, current-cycle sources.
- The active branch is based on `origin/main` at merge `4d95ed1`. Hosted run [39854247770](https://github.com/itssourov13/scholar-hub/actions/runs/39854247770) passed for the preceding Firebase/EAS/Vercel preparation merge, not for this catalogue-import branch. The workflow runs on pull requests, pushes to `main`, and manual dispatch; push the feature branch and open/update a PR to trigger its CI. The Web build uses an unreachable placeholder if `DATABASE_URL` is not configured, so green CI alone does not prove database integration.
- Earlier mobile checks passed lint, typecheck, Expo install compatibility, and Expo Doctor (20/20). The Metro/Router issue was traced to Node/F2FS Dirent misclassification of hard-linked regular package files; `packageImportMethod: copy` and reinstalling resolved that file-metadata issue. Diagnostic Android export passed for 2,216 modules and 77 assets, and standard Android export passed on hosted Ubuntu in run [39839441903](https://github.com/itssourov13/scholar-hub/actions/runs/39839441903). Local ARM64 Hermes incompatibility, EAS/native signing, and physical-device validation remain open.
- Android and iOS identifiers are configured as `com.scholarhub.app` for the intended separate ScholarHub listing. Store registration/availability and signing ownership remain unverified. The Clerk-free visual preview fix is merged; its opt-in flag is for trusted local review only and must not be used in production.

### Current open release gates

1. Push `feat/scholarship-catalogue-import`, open/update a pull request, and inspect the branch-specific Web and Mobile CI results. Then complete EAS/native signed-build validation and physical-device smoke tests.
2. Resolve the canonical production Neon project/branch. The inspected production branches lacked `public.scholarships`; reconcile the intended production schema and migrations with an approved backup/rollback plan before connecting Vercel or writing production data.
3. Manually review the 94 staging drafts and repair/review the other 215 source rows against official provider sources. Confirm current-cycle deadlines, nationality/academic eligibility, degree level, funding conditions, and application links. Do not publish unverified or expired/unknown-cycle records.
4. Add an enforced admin review/publish gate for `source_verification_status` and source provenance. RAG ingestion must remain separate and limited to verified, published records.
5. Register/verify the separate ScholarHub listing using `com.scholarhub.app`; verify signing, public HTTPS API URL, OAuth/deep links, and Firebase push delivery if push is in scope.
6. Finish credentials-backed auth and two-user authorization tests, route/API E2E, accessibility/performance checks, deployment smoke tests, and privacy/legal/operator/monitoring decisions.

## Change log for this draft

- `2026-10-22`: initial editable roadmap added. It records the suggested sequence from build stability through staging data, core workflows, security/offline capability, and staged web/Android release. Revise it as product priorities and verified blockers change.

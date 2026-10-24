# ScholarHub Production Roadmap (Draft)

_Status: active, editable release plan — updated 2026-10-23 after the Production schema migration. This is not a deployment or release claim._

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

## Content and data architecture direction

These are the intended product principles for catalogue and guide content. They describe the target design, not a claim that every Admin UI/API feature already exists.

- **Database is the content source of truth.** Scholarship and Guide records should be read from Neon through authorised APIs; individual content records must not be hardcoded into the web/mobile app. Code still defines schemas, validation, permissions, UI and business rules.
- **Admin-managed lifecycle.** The Admin Panel should support the missing parts of create, edit, save-as-draft, verify, publish, unpublish and archive for scholarships and Guides. Enforce permissions and publication rules on the server, not only in the UI. Keep provenance, verification state and change history where supported. Audit the current panel and implement only gaps; do not assume these controls are complete.
- **Incremental content is supported.** Content can be imported and reviewed in small batches before or after the first web deployment. Publishing an approved DB-backed record should not require an app redeploy; changes to application logic do. If content is not ready, public pages must show honest empty states and unfinished Mentor/Guide capabilities must not imply that real verified knowledge is available.
- **Future source sync is a separate feature.** Plan for an Admin-managed source registry, scheduled sync, source-specific extraction, duplicate/change detection, retries/rate limits, sync logs and a review queue. Sync should create/update drafts by default; do not auto-publish a changed deadline, eligibility, funding or application status without an explicitly approved rule and fresh evidence. Respect source terms, access controls and robots/rate policies.
- **AI/RAG follows publication policy.** AI may inspect source documents and prepare analyses/drafts, but only content that passes the configured verification/publication policy may become authoritative public Mentor context. Embeddings must be refreshable or removable when source content is changed, unpublished or archived.

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

### Phase 2 — Establish real catalogue and content data across environments

**Goal:** finish the safe content-management and import foundations, then release in controlled stages. The initial Web deployment may precede full catalogue/Guide population if the environment, security gates, build and smoke checks pass and empty/disabled states are honest. Add and publish real content incrementally; only individually reviewed, current and verified records may become public.

- [x] `P2.1` Verified the Singapore Neon staging branch `br-nameless-fog-a10fo0rl` and identified the existing local server-only DB configuration; local environment files remain staging-only.
- [x] `P2.2` Applied the tested Clerk/Neon baseline `018` plus additive migrations `019`–`028` to Singapore Production branch `br-divine-grass-a16og13f` after explicit approval. One transaction completed; verification found 14 public tables, 31 indexes, required scholarship/import fields, pgvector and `match_scholarship_docs`. At the 2026-10-23 checkpoint Production had zero content rows; the 2026-10-24 Phase 1 batch now has 5 verified scholarships and 5 guides (see the completion update below). See `PRODUCTION_DATABASE.md`.
- [x] `P2.3` Ran a preliminary structural audit of `cleaned_scholarships.json` (309 candidates) and confirmed importer output: 94 draft/unverified staging rows, 215 held for review. Full-source diagnostic counts overlap: 166 have no official URL, 81 lack country, 14 rows occur in duplicate-URL groups, 183 have past ISO-format dates, and 125 have no deadline.
- [x] `P2.4` Added a deterministic/idempotent staging-only importer and repeated a read-only check to confirm the 94 existing source identities were not duplicated.
- [ ] `P2.5` Review candidates against current official sources in small, trackable batches. Resolve official URLs, countries, duplicates, current intake/deadline, nationality/academic eligibility, degree level, funding details and required documents. A past source date alone does not prove permanent closure; verify the next cycle or retain/reject with an evidence-based reason. Full review of all 309 candidates can continue after the initial deployment; no unverified item may be published.
- [x] `P2.6` Implemented a local server-enforced Admin verification/publish gate, source-evidence/timestamp validation, invalidation after material edits, and publish UI attestation. Regression tests pass locally; this code is not hosted yet and must be deployed and tested before counting the guard as released.
- [x] `P2.7` Prepared and published five reviewed initial guides in Production. Staging remains empty; the public Guide reader uses published database rows and has no static/demo fallback. Initial slugs/source details are documented in `SCHOLARSHIP_DATA_IMPORT.md`.
- [ ] `P2.8` Test Web and Mobile scholarship/Guide APIs and rendered views against representative staged records, including published-only filters, empty/error states and cache/revalidation behaviour.
- [ ] `P2.9` Local code now gates single/batch ingestion and Mentor fact hydration/title lookup to published+verified records. Add focused RAG tests, deploy and verify this protection before generating embeddings. Production `ScholarshipDoc` remains empty by design.
- [ ] `P2.10` Build and rehearse a separately reviewed, idempotent Production import workflow using staging tests first. The existing `import-scholarships.ts` is intentionally staging-only; do not loosen its staging guard or reuse staging `DATABASE_URL` for Production.
- [ ] `P2.11` Audit Admin CRUD coverage for both Scholarships and Guides. Implement missing authorised create/edit/draft/unpublish/archive flows and validation in the server/API as well as UI; preserve source provenance and status history where supported. Ordinary content changes should be database records, not hardcoded code changes.
- [ ] `P2.12` After the initial Web deployment and Production connection are verified, import and publish reviewed content in small batches. After each batch, reconcile row counts/statuses, sample-check the public API/UI, and ingest/update RAG only for records that satisfy the verified/publication policy.
- [ ] `P2.13` `Deferred` Design and implement automatic official-source web sync as a later feature: Admin-managed source registry, scheduled jobs, allowed source rules, extraction, duplicate/change detection, safe retries/rate limits, run logs, and a draft review queue. Default to draft-first; automatic publication is a separate explicit policy decision, not a side effect of scraping.

**Exit criteria for the content foundation:** source review and publication are enforceable; import is safe and repeatable; public pages handle empty states; the first public batch can be added incrementally; and unverified/stale candidates remain drafts or are rejected with reasons, not silently discarded or auto-published. Full catalogue coverage and automated sync are not prerequisites for the initial Web deployment unless a selected release feature depends on them.

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

**Goal:** deploy the Web foundation when production configuration and release-critical safety checks pass, then expand live content and later mobile availability in controlled stages. The complete catalogue and automatic web sync may follow after launch; this does not waive source verification, RAG protections or honest empty states.

- [ ] `P5.1` Decide the production domain, hosting/deployment target, support identity, analytics/ads ownership, monitoring, and rollback process.
- [ ] `P5.2` Keep staging and production environment variables/secrets separate. Configure the real production database and only the Clerk, AI, R2, Redis, email, webhook, and other services that are actually enabled.
- [ ] `P5.3` Keep `SCHOLARHUB_LOCAL_PREVIEW` unset in Vercel/production. Verify normal Clerk middleware, production auth, callbacks, OAuth, webhooks, and mobile redirects using test accounts.
- [ ] `P5.4` Register/verify the separate ScholarHub listing using `com.scholarhub.app`; confirm package registration/availability and signing ownership in the Play Console before publishing. Do not treat this as an in-place update to the legacy BairePorbo listing.
- [ ] `P5.5` Finalise approved logo/favicon/social/open-graph/launcher/adaptive/splash assets, app links/deep links, Firebase/push settings, signing and EAS release configuration.
- [ ] `P5.6` Set the mobile production API base to the deployed HTTPS API (not `localhost`), build a signed Android App Bundle, and test installation/update, login, API access, notifications if enabled, and critical journeys on real devices.
- [ ] `P5.7` Complete the web production build and browser/device smoke tests against production-like services; verify migrations, the exact Production DB target, auth/authorisation, errors, logs, rate limits, performance, honest empty states, and recovery procedures. Do not expose unverified catalogue content or unsafe RAG retrieval just because the app is deployed.
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

- `apps/web` contains the Next.js app and API routes; `apps/mobile` is the separate Expo/React Native app. The selected Neon target is project `shy-darkness-67521294`, Singapore (`aws-ap-southeast-1`), Production branch `br-divine-grass-a16og13f`; Vercel Function region is set to `sin1`.
- Production migrations `018`–`028` were applied and verified on 2026-10-23. At that schema-only checkpoint Production had 0 scholarship rows, 0 `ScholarshipDoc` rows and 0 guides. A separate Phase 1 content transaction on 2026-10-24 now adds five published verified scholarships and five published guides; RAG remains empty.
- Staging branch `br-nameless-fog-a10fo0rl` has 94 draft/unverified scholarship rows, 0 published/live rows, 0 RAG docs and 0 guides. The 309-row source file has 215 held rows; reason counts overlap. In the 94 staging records, 58 have past ISO-format deadlines and 36 have no deadline. Each record needs current-cycle verification before publication.
- The guides feature reads only published rows from the `guides` table and has no static/demo fallback. A trusted initial guide collection must be identified/created and populated. Checked staging private/user-data tables (profiles, CVs/analyses, chats/messages, bookmarks, tasks, roadmaps/milestones) are empty; do not seed invented personal data.
- Source inspection shows RAG ingestion/retrieval still needs a server-side verification/publication gate. The single-record ingest handler can load an arbitrary scholarship ID; batch ingest checks `status='published'` but not source verification; retrieval must not treat unverified/draft vectors as authoritative. No embeddings have been generated yet.
- Vercel has no ScholarHub project visible in the connected account/scope. No env vars were changed and no deployment was triggered. Both local database URLs target staging and must not be reused for Production.
- Earlier local Web checks for `audit/production-neon-target` passed on Node 22.23.1 / pnpm 11.1.3: lint, typecheck, 388 tests over 21 files, Webpack build (56 static pages/routes), JSON validation, `git diff --check` and docs-link scan. The build's existing Cache-Control warning for `/_next/static/:path*` was non-blocking. These results predate the current docs-only updates and do not establish hosted deployment or real-data integration.
- The user's current preference allows an initial Vercel Web deployment after required environment configuration, release-critical security/RAG controls, and build/auth/database/empty-state smoke checks pass, then adding and publishing reviewed content gradually in small batches. Full catalogue review and future automatic web sync can continue after launch. Do not trigger a deploy without explicit instruction; run real production smoke tests after deployment.

### Current ordered work

1. Implement/test the server-enforced verification/publish rules and close the single-record, batch and retrieval RAG safety gaps. If a public feature depends on unfinished safeguards, keep that feature disabled until fixed.
2. Confirm the complete Vercel environment-variable matrix and Production target; keep Preview/staging credentials separate. Finish build, typecheck, tests, auth/database/API and honest empty-state smoke checks.
3. Prepare a small source-reviewed scholarship batch and, if available, a trusted Guide batch. Full review of the 309 scholarship candidates can continue incrementally; never promote unverified data.
4. Rehearse a separate idempotent Production import workflow in staging. Audit Admin CRUD and implement missing create/edit/draft/verify/publish/unpublish/archive operations so content records are not hardcoded.
5. Connect the repository to the intended Vercel account. After the user explicitly authorises the initial deploy, deploy the Web foundation and verify it against the exact Production database target.
6. Populate and publish content in small batches after deployment; reconcile counts/statuses and test public API/UI after each batch. Generate/refresh RAG embeddings only for allowed verified/public content.
7. Review whether any legitimate private user data exists outside staging. Never seed dummy profiles/CVs/chat/roadmaps; migrate real private data only through a separately authorised process.
8. Run ongoing catalogue source review and Guide population. Keep automatic official-source web sync as a later feature with a source registry, scheduling, change detection, audit logs and draft-first human review.

## Change log for this draft

- `2026-10-22`: initial editable roadmap added; phases covered repository stability, staging data, core product, privacy/offline, and staged Web/Android release.
- `2026-10-23`: updated after the approved Production schema migration. Reordered Phase 2 around actual content, guide population, publication enforcement and RAG safeguards. Explicitly distinguished completed schema work from the still-empty Production catalogue and Guides collection.
- `2026-10-23`: clarified the database-as-source-of-truth/Admin-managed content model, incremental post-deploy data batches, release gates for safe empty states, and the deferred draft-first automatic official-source sync feature.

## Phase 1 execution update — 2026-10-24

### Completed

- [x] Confirmed the only permitted content target for this batch: Neon project `shy-darkness-67521294`, Singapore Production branch `br-divine-grass-a16og13f`, database `neondb`. Kept staging (`br-nameless-fog-a10fo0rl`) separate; did not alter its 94 unverified drafts.
- [x] Added five source-reviewed scholarships: UBC International Scholars 2027; KAIST 2027 international undergraduate scholarship; 2027 GKS-U; Brunei Government Scholarship Scheme 2027/2028; and Türkiye Scholarships bachelor's (next cycle). Unknown dates and Bangladesh eligibility caveats remain explicitly recorded rather than guessed.
- [x] Added five guides: deadline/application timeline, undergraduate document checklist, personal statement/study plan, funding comparison, and scholarship verification/scam avoidance.
- [x] Verified Production counts (5 scholarships published+verified, 5 guides published, 0 RAG docs) and live API/direct-detail smoke results (all relevant endpoints returned HTTP 200). Seed rows suppress unintended initial content push notifications.
- [x] Implemented local source verification/publish gate, verification invalidation after material edits, verified-only public scholarship reads/AI context/RAG ingestion, accurate metadata copy and focused regression tests on `feat/phase1-curated-content`.

### Open before considering Phase 1 released

- [x] Final local lint/typecheck/test/build results recorded in local-only `report.md`: lint/typecheck PASS; 392 tests/22 files PASS; Webpack build PASS (56 routes); `git diff --check` PASS.
- [ ] The hosted `/scholarships` and `/guide` static index HTML remains empty/stale (no new item titles) and includes old `300+` copy; the cached KAIST detail still says `Full funding` while the live DB/API say `partial`. Push/deploy the local metadata/source gate changes under the user's authorisation, rebuild/revalidate affected paths, then test the actual visible list items and funding label.
- [ ] Deploy the local verification gate before treating it as a hosted security control. Current live database APIs reflect the new rows, but that is not proof the new source-gate code is deployed.
- [ ] Keep `ScholarshipDoc`/RAG empty until gates have passed final checks and verified records are intentionally ingested.
- [ ] Revisit each source before its next date: Brunei Bangladesh eligibility and detailed benefits remain unknown pending current-cycle terms; GKS dates vary by track; Türkiye's exact 2027 dates remain unannounced. Do not silently turn a recurring window into a confirmed deadline.

No commit, push or deploy was triggered. This update is appended to preserve earlier user edits to this roadmap.

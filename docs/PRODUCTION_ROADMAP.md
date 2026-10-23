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

**Goal:** prepare reviewed, useful real content for both clients before the first planned Production deployment. The schema work is complete; data quality, source review, guide content, public publish policy and integration checks are the active work.

- [x] `P2.1` Verified the Singapore Neon staging branch `br-nameless-fog-a10fo0rl` and identified the existing local server-only DB configuration; local environment files remain staging-only.
- [x] `P2.2` Applied the tested Clerk/Neon baseline `018` plus additive migrations `019`–`028` to Singapore Production branch `br-divine-grass-a16og13f` after explicit approval. One transaction completed; verification found 14 public tables, 31 indexes, required scholarship/import fields, pgvector and `match_scholarship_docs`. Production still has zero content rows. See `PRODUCTION_DATABASE.md`.
- [x] `P2.3` Ran a preliminary structural audit of `cleaned_scholarships.json` (309 candidates) and confirmed importer output: 94 draft/unverified staging rows, 215 held for review. Full-source diagnostic counts overlap: 166 have no official URL, 81 lack country, 14 rows occur in duplicate-URL groups, 183 have past ISO-format dates, and 125 have no deadline.
- [x] `P2.4` Added a deterministic/idempotent staging-only importer and repeated a read-only check to confirm the 94 existing source identities were not duplicated.
- [ ] `P2.5` Review all candidates against current official sources. Resolve source URL, country, duplicates, intake/deadline, nationality/academic eligibility, degree level, funding details and required documents. A past source date alone does not prove a programme is permanently closed; verify the next cycle or retain/reject with an evidence-based reason.
- [ ] `P2.6` Add/test a server-enforced admin verification/publish policy using provenance and verification state. The database field exists; the complete review UI and enforce-publish gate are not yet wired end to end.
- [ ] `P2.7` Locate/confirm trusted initial Guides/Articles source content and populate `guides` using draft-first review. Staging and Production currently have zero guide rows, and the public guide reader has no static fallback; this is a real-content release blocker.
- [ ] `P2.8` Test the Web and Mobile scholarship/guide APIs and rendered views against real staged content, including published-only filters, empty/error states and cache/revalidation behaviour.
- [ ] `P2.9` Close RAG safety gaps before generating embeddings. Single-record ingestion currently lacks a published/verified gate; batch ingestion filters published status but not verification status; Mentor retrieval must not treat unverified/draft vectors as authoritative. After code/tests land, ingest only content allowed by the verified/publication policy.
- [ ] `P2.10` Import the reviewed scholarship and guide content into Production through a separately reviewed, idempotent production workflow; verify counts/statuses after writes. The current `import-scholarships.ts` is intentionally staging-only, and schema migration did not copy data.

**Exit criteria:** Production contains a reconciled set of source-reviewed current-cycle scholarships and the initial reviewed guide collection; only intentionally published records are public; data counts/statuses are independently checked; RAG has vectors only for the allowed source set; public Web/Mobile catalogue and Guide views are tested against real records. Unverified/stale candidates remain drafts or are rejected, not silently discarded or auto-published.

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

- `apps/web` contains the Next.js app and API routes; `apps/mobile` is the separate Expo/React Native app. The selected Neon target is project `shy-darkness-67521294`, Singapore (`aws-ap-southeast-1`), Production branch `br-divine-grass-a16og13f`; Vercel Function region is set to `sin1`.
- Production migrations `018`–`028` have now been applied and verified. The branch has 14 public tables, 31 indexes, the vector extension, the `match_scholarship_docs` function, and the expected scholarship/provenance/roadmap fields. Production has 0 scholarship rows, 0 `ScholarshipDoc` rows and 0 guide rows; this was schema-only setup, not a content migration.
- Staging branch `br-nameless-fog-a10fo0rl` has 94 draft/unverified scholarship rows, 0 published/live rows, 0 RAG docs and 0 guides. The 309-row source file has 215 held rows; reason counts overlap. In the 94 staging records, 58 have past ISO-format deadlines and 36 have no deadline. Each record needs current-cycle verification before publication.
- The guides feature reads only published rows from the `guides` table and has no static/demo fallback. A trusted initial guide collection must be identified/created and populated. Checked staging private/user-data tables (profiles, CVs/analyses, chats/messages, bookmarks, tasks, roadmaps/milestones) are empty; do not seed invented personal data.
- Source inspection shows RAG ingestion/retrieval still needs a server-side verification/publication gate. The single-record ingest handler can load an arbitrary scholarship ID; batch ingest checks `status='published'` but not source verification; retrieval must not treat unverified/draft vectors as authoritative. No embeddings have been generated yet.
- Vercel has no ScholarHub project visible in the connected account/scope. No env vars were changed and no deployment was triggered. Both local database URLs target staging and must not be reused for Production.
- Earlier local Web checks for `audit/production-neon-target` passed on Node 22.23.1 / pnpm 11.1.3: lint, typecheck, 388 tests over 21 files, Webpack build (56 static pages/routes), JSON validation, `git diff --check` and docs-link scan. The build's existing Cache-Control warning for `/_next/static/:path*` was non-blocking. These results predate the current docs-only updates and do not establish hosted deployment or real-data integration.
- The user’s deployment preference is to finish content review, guide population, RAG/access safeguards, and the Vercel environment-variable checklist before the first planned deployment. Do not trigger a deploy without explicit instruction. The deployment itself must still be followed by real production smoke tests.

### Current ordered work

1. Audit and review scholarship source candidates. Keep the 94 existing staging rows unverified until official/current-cycle checks; assess the 215 held rows rather than discard them solely due to importer hold reasons.
2. Locate/confirm trusted guide source content and decide which guides should initially be published. Populate `guides` with review/publish status; verify its web API/page.
3. Implement and test admin verification/publish enforcement and RAG ingest/retrieval filtering. AI can read official/source documents and create analysis/drafts; it must not mislabel unverified output as verified fact.
4. Create a reviewed production-capable idempotent import/seed workflow. Import approved catalogue and guide content into Production; verify totals/statuses. Generate embeddings only for content permitted by the reviewed policy.
5. Check whether any legacy private user data exists outside staging. User profiles, CVs/analyses, conversations, bookmarks, tasks and roadmaps should be populated from legitimate user activity or a separately authorised private migration, never dummy seed data.
6. Connect/import `itssourov13/scholar-hub` in the intended Vercel account and complete the environment-variable matrix using the Production branch URL. Keep local/staging and Production credentials distinct; configure only integrations used by the release.
7. Before the first deployment, run all relevant lint/typecheck/unit/build/CI and credentials-backed integration/auth tests; verify mobile HTTPS API config, signing and device flows, legal/operator/monitoring/rollback needs. After the user authorises deployment, smoke-test the deployed Web, Guide, scholarship, Mentor, authentication and mobile API journeys.

## Change log for this draft

- `2026-10-22`: initial editable roadmap added; phases covered repository stability, staging data, core product, privacy/offline, and staged Web/Android release.
- `2026-10-23`: updated after the approved Production schema migration. Reordered Phase 2 around actual content, guide population, publication enforcement and RAG safeguards. Explicitly distinguished completed schema work from the still-empty Production catalogue and Guides collection.

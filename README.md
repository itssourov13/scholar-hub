# ScholarHub

**ScholarHub** is an evolving scholarship discovery and application-management platform. It is being adapted from an existing full-stack scholarship product, with the goal of supporting a wider international student audience over time.

The initial product focus is to help students discover undergraduate scholarships and university programmes, understand eligibility and funding, manage applications, organise documents, and track deadlines—with source evidence and useful offline capability.

> **Current status (2026-10-23; not a release claim):** PR #4 catalogue import is merged at `33e88e0`. The Singapore Production database schema migration (`018`–`028`) has now completed and was verified: 14 public tables, 31 indexes, the pgvector extension and RAG matching function are present. Production still contains **0 scholarships and 0 RAG documents**. Staging has 94 draft/unverified candidates and no published/live scholarships; 58 of those 94 have past ISO-format deadlines and 36 have no deadline. Another 215 of the 309 source candidates remain held for data-quality review; reason counts overlap. Staging and Production currently have 0 guide rows. Vercel Functions are configured for `sin1`, but no ScholarHub project is visible in the connected Vercel scope, so env vars and deployment remain untouched. The current branch is `audit/production-neon-target`; earlier local lint/typecheck/388-test/56-route build checks passed on Node 22.23.1 / pnpm 11.1.3, but these are not production integration tests. See [Production database target](docs/PRODUCTION_DATABASE.md), [Scholarship data import](docs/SCHOLARSHIP_DATA_IMPORT.md), [Production roadmap](docs/PRODUCTION_ROADMAP.md) and [Current State](docs/CURRENT_STATE.md). Data verification, guide content import, RAG safety gates, complete environment configuration, auth/E2E, app signing/device checks and release verification remain outstanding.

## Product principles

- Prefer official university, government, and scholarship-provider sources for material facts.
- Preserve source URLs, verification dates, field-level evidence, uncertainty, and change history.
- Keep public scholarship research data separate from each user's private profile and application data.
- Explain eligibility results; do not present a match score as a probability of admission.
- Never label a scholarship fully funded based on tuition coverage alone.
- Build useful offline behaviour deliberately, with visible sync status and safe conflict handling.
- Preserve privacy, portability, and deletion/export options as the audience grows.

## Planned product areas

- Public scholarship and university catalogue with flexible country, degree, intake, subject, funding, eligibility, test, fee, and deadline filters.
- Applicant profile and explainable eligibility matching.
- Funding and out-of-pocket cost comparison.
- Personal application tracker, tasks, calendar, reminders, essays, and document-version metadata.
- Web research, URL import, evidence review, and change detection.
- Offline access to saved records, local edits, and a reliable manual sync workflow.
- Optional authenticated cross-device sync.
- Public contribution/correction workflow with moderation rather than automatic publication of unverified facts.

These are product goals, not a claim that every feature is already implemented.

## Existing codebase

The project remains in the existing workspace. The current codebase includes a Next.js web application, a separate Expo/React Native mobile client, scholarship administration, AI-assisted scholarship summaries, an AI mentor, profile/dashboard features, a study-abroad roadmap, a CV builder/analyser, guides, and an existing authentication/database/API foundation.

See [Current State](docs/CURRENT_STATE.md) for what was observed in the repository and what still requires runtime verification.

## Documentation map

- [Project context](docs/PROJECT_CONTEXT.md) — product goals, audience, and scope.
- [Current state](docs/CURRENT_STATE.md) — observed implementation and known gaps.
- [Architecture](docs/ARCHITECTURE.md) — existing architecture and target evolution.
- [Decisions](docs/DECISIONS.md) — durable architecture and product decisions.
- [Task state](docs/TASK_STATE.md) — current phase, priorities, and acceptance criteria.
- [Production roadmap (draft)](docs/PRODUCTION_ROADMAP.md) — current release sequence across catalogue, guides, AI/RAG, web/mobile, security and deployment; phases can be revised as evidence changes.
- [Changelog](docs/CHANGELOG.md) — meaningful project changes.
- [Handoff](docs/HANDOFF.md) — exact next steps for a future session.
- [Security and privacy](docs/SECURITY_AND_PRIVACY.md) — personal data, imports, storage, and public-release risks.
- [Vercel deployment guide](docs/VERCEL_DEPLOYMENT.md) — web project settings, Singapore Function region, environment-variable checklist, and pre-release verification steps.
- [Production database target](docs/PRODUCTION_DATABASE.md) — Singapore Neon target, completed production schema migration, verified empty content tables, and pre-deployment data/configuration checklist.
- [Scholarship data import](docs/SCHOLARSHIP_DATA_IMPORT.md) — source mapping, staging-only dry-run/import commands, and manual review gates.

## Workspace and development commands

The existing workspace path is currently:

`/home/kali/gpt-workspace/BairePorbo`

The directory name is a local workspace detail, not the product name. Work in this repository; do not create a parallel workspace or rewrite the application from scratch unless a later, explicit decision requires it.

The web app lives in `apps/web`. Run its commands from that directory. Its package scripts currently define:

- `pnpm dev` — development server
- `pnpm lint` — ESLint
- `pnpm typecheck` — TypeScript check
- `pnpm test` — Vitest suite
- `pnpm build` — production build

The mobile app lives in `apps/mobile`. Run its commands from that directory; it defines `start`, `android`, `ios`, `web`, `typecheck`, `lint`, and `doctor` scripts. On Android/Termux F2FS, `packageImportMethod: copy` is intentional: it prevents a Node filesystem metadata issue that made Metro skip hard-linked package files.

The root, web, and mobile directories are separate pnpm roots with separate lockfiles; there is no single root pnpm workspace. In this working tree, frozen-lockfile dependency installs completed for all three roots. From a fresh checkout, install each root independently before checks:

- `pnpm install --frozen-lockfile` from the repository root.
- `pnpm install --frozen-lockfile` from `apps/web`.
- `pnpm install --frozen-lockfile` from `apps/mobile`.

The CI workflow at `.github/workflows/ci.yml` runs web lint/typecheck/tests/build and mobile lint/typecheck/Expo checks/standard Android export for pull requests, pushes to `main`, and manual dispatch. PR #4 is already merged and its hosted Web/Mobile jobs passed. For the current `audit/production-neon-target` branch, a push should be followed by opening/updating a pull request and inspecting both jobs; a push to an arbitrary feature branch alone does not trigger CI. Current local verification is recorded above and in [Current State](docs/CURRENT_STATE.md). The Web build uses an unreachable placeholder if the `DATABASE_URL` secret is not configured, so green CI does not prove database integration.

## Importing the supplied scholarship materials

The client-supplied archive and workbook are source inputs, not application assets to commit to the repository. Preserve original files, work on a separate import copy, validate records before writing to the database, and keep personal certificates, transcripts, essays, CVs, signatures, and recommendation letters private by default. The current 309-row JSON dataset has a conservative staging-only importer; its default is read-only, and successful rows remain drafts until manually verified. See [Scholarship data import](docs/SCHOLARSHIP_DATA_IMPORT.md), [Project Context](docs/PROJECT_CONTEXT.md), and [Security and Privacy](docs/SECURITY_AND_PRIVACY.md).

## Project status

PR #4 catalogue-import changes are merged. The selected Singapore Production database now has its schema (`018`–`028` applied and checked), but no scholarship, RAG or guide content has been populated. Staging has 94 draft/unverified scholarships; all need current-cycle verification because 58 have past ISO-format deadlines and 36 have no deadline. A further 215 source candidates are held for data-quality review. The connected Vercel workspace has no visible ScholarHub project; env vars and deployment have not been configured. Next steps are a full source/guide-content audit, enforced publish/RAG safeguards, population of verified Production content, configuration of all required Vercel variables, and final integration/release checks. Auth/authorization E2E, app-store identity, EAS signing, Firebase delivery, device tests, and legal/operator/monitoring decisions remain open. See [Current State](docs/CURRENT_STATE.md), [Task State](docs/TASK_STATE.md), [Production Database Target](docs/PRODUCTION_DATABASE.md), [Scholarship data import](docs/SCHOLARSHIP_DATA_IMPORT.md), [Vercel Deployment](docs/VERCEL_DEPLOYMENT.md), and [Production Roadmap](docs/PRODUCTION_ROADMAP.md).

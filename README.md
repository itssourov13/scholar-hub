# ScholarHub

**ScholarHub** is an evolving scholarship discovery and application-management platform. It is being adapted from an existing full-stack scholarship product, with the goal of supporting a wider international student audience over time.

The initial product focus is to help students discover undergraduate scholarships and university programmes, understand eligibility and funding, manage applications, organise documents, and track deadlines—with source evidence and useful offline capability.

> **Current status (2026-10-23; not a release claim):** GitHub Actions run [39854247770](https://github.com/itssourov13/scholar-hub/actions/runs/39854247770) passed after the Firebase/EAS/Vercel preparation merge (PR #3). The active local branch `feat/scholarship-catalogue-import` adds an idempotent, dry-run-first source importer, additive schema/provenance migration, and a public API regression fix. A controlled run placed 94 unverified draft rows in Neon staging only; no scholarship is published and no production branch was modified. Local final checks on Node 22.23.1 passed lint, typecheck, 388 tests across 21 files, Webpack build (56 static pages/routes), and `git diff --check`; a non-blocking Cache-Control warning remains in the build output. See [Scholarship data import](docs/SCHOLARSHIP_DATA_IMPORT.md) and the local-only `report.md`. Canonical production Neon project/branch remains unresolved; EAS signing/device, push delivery, authorization E2E, and actual Vercel deployment are still unverified.

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
- [Production roadmap (draft)](docs/PRODUCTION_ROADMAP.md) — temporary, editable proposal for staging and web/mobile release; phases can be changed.
- [Changelog](docs/CHANGELOG.md) — meaningful project changes.
- [Handoff](docs/HANDOFF.md) — exact next steps for a future session.
- [Security and privacy](docs/SECURITY_AND_PRIVACY.md) — personal data, imports, storage, and public-release risks.
- [Vercel deployment guide](docs/VERCEL_DEPLOYMENT.md) — web project settings, environment-variable checklist, and pre-release verification steps.
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

The CI workflow at `.github/workflows/ci.yml` runs web lint/typecheck/tests/build and mobile lint/typecheck/Expo checks/standard Android export for pull requests, pushes to `main`, and manual dispatch. A push to a feature branch alone does not trigger CI; after pushing `feat/scholarship-catalogue-import`, open or update its pull request and inspect both jobs. The earlier published head and the Firebase/EAS/Vercel preparation merge passed hosted CI, but those runs do not certify this catalogue-import branch. Its local verification is recorded above and in [Current State](docs/CURRENT_STATE.md). The Web build uses an unreachable placeholder if the `DATABASE_URL` secret is not configured, so green CI does not prove database integration.

## Importing the supplied scholarship materials

The client-supplied archive and workbook are source inputs, not application assets to commit to the repository. Preserve original files, work on a separate import copy, validate records before writing to the database, and keep personal certificates, transcripts, essays, CVs, signatures, and recommendation letters private by default. The current 309-row JSON dataset has a conservative staging-only importer; its default is read-only, and successful rows remain drafts until manually verified. See [Scholarship data import](docs/SCHOLARSHIP_DATA_IMPORT.md), [Project Context](docs/PROJECT_CONTEXT.md), and [Security and Privacy](docs/SECURITY_AND_PRIVACY.md).

## Project status

The ScholarHub brand foundation and Firebase/EAS/Vercel preparation are merged into `main`. The active local branch `feat/scholarship-catalogue-import` adds a safe catalogue importer, schema/provenance migration, and a fix ensuring the public scholarship API cannot expose drafts via a query parameter. Ninety-four records are loaded to staging as unverified drafts only. The canonical production Neon project/branch is still unresolved; production schema, record verification/publication, authorization E2E, app-store identity, EAS signing, Firebase delivery, public API deployment, device tests, and legal/operator/monitoring decisions remain. See [Current State](docs/CURRENT_STATE.md), [Task State](docs/TASK_STATE.md), [Scholarship data import](docs/SCHOLARSHIP_DATA_IMPORT.md), and [Production Roadmap](docs/PRODUCTION_ROADMAP.md).

# ScholarHub

**ScholarHub** is an evolving scholarship discovery and application-management platform. It is being adapted from an existing full-stack scholarship product, with the goal of supporting a wider international student audience over time.

The initial product focus is to help students discover undergraduate scholarships and university programmes, understand eligibility and funding, manage applications, organise documents, and track deadlines—with source evidence and useful offline capability.

> **Current status (2026-10-23; not a release claim):** GitHub Actions run [39839441903](https://github.com/itssourov13/scholar-hub/actions/runs/39839441903) passed both Web (lint, typecheck, 375 tests, build) and Mobile (lint, typecheck, Expo validation/Doctor, standard Android export) jobs for commit `608711a`. The local ARM64/Termux export still fails at Hermes because its compiler binary is x86-64; hosted Ubuntu confirmed the regular export works there. The current local follow-up restores mobile local-secret ignore rules, binds web role state to the authenticated user ID, and adds four regression tests; local lint/typecheck, all 379 tests and the Webpack production build (56 routes) pass. This commit must be pushed and CI rerun. Real database/staging content, authorization E2E, EAS signed build, store listing, Firebase push, and real-device release checks remain unverified.

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

The CI workflow at `.github/workflows/ci.yml` runs web lint/typecheck/tests/build and mobile lint/typecheck/Expo checks/standard Android export on pull requests and pushes to `main`. The current published branch head has a successful hosted run; the current local follow-up needs to be pushed and checked again. The Web build uses an unreachable placeholder if the `DATABASE_URL` secret is not configured, so green CI does not prove database integration. See [Current State](docs/CURRENT_STATE.md) for evidence and remaining release gates.

## Importing the supplied scholarship materials

The client-supplied archive and workbook are source inputs, not application assets to commit to the repository. Preserve original files, work on a separate import copy, validate records before writing to the database, and keep personal certificates, transcripts, essays, CVs, signatures, and recommendation letters private by default. The import process is described in [Project Context](docs/PROJECT_CONTEXT.md) and [Security and Privacy](docs/SECURITY_AND_PRIVACY.md).

## Project status

The ScholarHub brand foundation and Clerk-free local visual-preview fix are merged into `main`. The readiness branch's published head passed hosted Web and Mobile CI, including normal Android export on Ubuntu. A local follow-up adds generic mobile secret/generated-file ignore safeguards, prevents role state from carrying across user switches, and corrects these docs; that follow-up still needs a push and fresh CI run. The project is not release-ready: production/staging database and real catalogue import, authorization/E2E coverage, app-store listing/identity verification, EAS signing, matching Firebase configuration if push is used, public HTTPS API configuration, device tests, and legal/operator/monitoring decisions remain. See [Current State](docs/CURRENT_STATE.md), [Task State](docs/TASK_STATE.md), and [Production Roadmap](docs/PRODUCTION_ROADMAP.md).

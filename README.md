# ScholarHub

**ScholarHub** is an evolving scholarship discovery and application-management platform. It is being adapted from an existing full-stack scholarship product, with the goal of supporting a wider international student audience over time.

The initial product focus is to help students discover undergraduate scholarships and university programmes, understand eligibility and funding, manage applications, organise documents, and track deadlines—with source evidence and useful offline capability.

> **Current status (local working branch, 2026-10-23):** Web lint/typecheck, all 375 tests, the production build (56 routes, using the configured local environment), and production dependency audit pass. Mobile lint/typecheck, Expo package alignment, and Expo Doctor (20/20 checks) pass. The Metro expo-router/entry resolution root cause is fixed locally by using copied mobile dependencies; the diagnostic Android bundle passes with 2,216 modules and 77 assets. The regular local export then fails at Hermes bytecode generation with SIGILL because this ARM64 host has an x86-64 Hermes compiler. The new hosted-Ubuntu CI check has not run yet. Store identity, Firebase, EAS/signing, real-device, and staging-data checks remain unverified. These changes are local, uncommitted, and unpushed; do not treat them as release-ready.

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

The CI workflow at `.github/workflows/ci.yml` runs web lint/typecheck/tests/build and mobile lint/typecheck/Expo checks/standard Android export on pull requests and pushes to `main`. Its first GitHub-hosted run is pending. See [Current State](docs/CURRENT_STATE.md) for actual local results and remaining blockers. Successful installation, a diagnostic `--no-bytecode` export, or typecheck alone does not mean a releasable native build is ready.

## Importing the supplied scholarship materials

The client-supplied archive and workbook are source inputs, not application assets to commit to the repository. Preserve original files, work on a separate import copy, validate records before writing to the database, and keep personal certificates, transcripts, essays, CVs, signatures, and recommendation letters private by default. The import process is described in [Project Context](docs/PROJECT_CONTEXT.md) and [Security and Privacy](docs/SECURITY_AND_PRIVACY.md).

## Project status

The ScholarHub documentation/brand foundation and Clerk-free local visual-preview fix are merged into main. On the local readiness branch, web lint/typecheck, all 375 tests, web production build (56 routes), dependency audit, mobile lint/typecheck/Expo package check, and Expo Doctor all pass. The Android Metro resolution root cause is fixed locally; a diagnostic Android bundle passes, while normal local export reaches Hermes and then fails with SIGILL because this ARM64 host uses an x86-64 Hermes compiler. A CI workflow now checks normal export on hosted Ubuntu, but that GitHub run is pending. Store identity, Firebase, signing, staging-data and real-device smoke tests remain unverified. See [Current State](docs/CURRENT_STATE.md), [Task State](docs/TASK_STATE.md), and the intentionally editable [Production Roadmap (Draft)](docs/PRODUCTION_ROADMAP.md).

# ScholarHub

**ScholarHub** is an evolving scholarship discovery and application-management platform. It is being adapted from an existing full-stack scholarship product, with the goal of supporting a wider international student audience over time.

The initial product focus is to help students discover undergraduate scholarships and university programmes, understand eligibility and funding, manage applications, organise documents, and track deadlines—with source evidence and useful offline capability.

> **Current status:** Core web/mobile copy and metadata, PWA labels, Expo display name/slug/scheme, shared TypeScript package scope, and the service-worker cache namespace now use ScholarHub. The legacy APK and assetlinks file were removed; old Play Store/Telegram/support/social destinations are unset or configuration-driven, and the previous AdSense/Meta tracking integrations were disabled. Legacy logo/icon/splash artwork, Android/iOS application IDs, Firebase configuration, upload signing settings, and deployment credentials still need a planned migration. Legal policy pages are explicitly marked as pre-release drafts. Do not deploy this branch as a released ScholarHub product yet.

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

The mobile app lives in `apps/mobile`. Run its commands from that directory; it defines `start`, `android`, `ios`, `web`, `typecheck`, `lint`, and `doctor` scripts.

The root, web, and mobile directories are separate pnpm roots with separate lockfiles; there is no single root pnpm workspace. In this working tree, frozen-lockfile dependency installs completed for all three roots. From a fresh checkout, install each root independently before checks:

- `pnpm install --frozen-lockfile` from the repository root.
- `pnpm install --frozen-lockfile` from `apps/web`.
- `pnpm install --frozen-lockfile` from `apps/mobile`.

See [Current State](docs/CURRENT_STATE.md) for the real typecheck/test/lint/build/export outcomes and the remaining blockers. Successful install or typecheck alone does not mean the product is production-ready.

## Importing the supplied scholarship materials

The client-supplied archive and workbook are source inputs, not application assets to commit to the repository. Preserve original files, work on a separate import copy, validate records before writing to the database, and keep personal certificates, transcripts, essays, CVs, signatures, and recommendation letters private by default. The import process is described in [Project Context](docs/PROJECT_CONTEXT.md) and [Security and Privacy](docs/SECURITY_AND_PRIVACY.md).

## Project status

The immediate priority is to establish a reliable documentation baseline, verify the current build/test setup, map the existing code to the ScholarHub requirements, and then deliver focused, testable increments. Full brand replacement, import tooling, expanded application tracking, source verification, and stronger offline/sync behaviour remain explicit work items.

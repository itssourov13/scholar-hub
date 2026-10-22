# ScholarHub — Agent and contributor instructions

## Product identity and scope

- The product name is **ScholarHub**.
- Work in the existing repository at `/home/kali/gpt-workspace/BairePorbo`. Do not create another workspace/repository unless explicitly asked.
- This is an evolution of an existing application, not a greenfield rewrite. Inspect the relevant implementation first and prefer small, reviewable changes that reuse working functionality.
- The local directory name and legacy integration identifiers may remain during migration. Primary user-facing name strings and display labels have been moved to ScholarHub on this branch, but legacy assets, domains, contact details, legal/operator copy, Android/iOS package IDs, OAuth configuration, signing, push notifications, Firebase settings, and deep links still require a planned, verified migration. Do not introduce new user-facing references to the previous brand.

## Source of truth

Read these before substantial work:
1. `docs/PROJECT_CONTEXT.md`
2. `docs/CURRENT_STATE.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DECISIONS.md`
5. `docs/TASK_STATE.md`

Keep documentation aligned with the implementation. Clearly label verified facts, assumptions, proposed work, and unverified behaviour. Do not copy stale deployment or architecture claims from removed legacy documents.

## Engineering workflow

- Start by inspecting `git status`, the current branch, the relevant files, and nearby tests.
- Preserve unrelated local changes. Never reset, clean, or overwrite user changes to make the tree look tidy.
- Use focused feature/documentation branches when practical. Commit only when asked or when the task's established workflow requests it; do not push or deploy without explicit instruction.
- Keep changes small and explain the exact scope. Avoid unrelated refactors, dependency upgrades, UI redesigns, animation changes, or layout changes.
- Read the installed Next.js documentation under `apps/web/node_modules/next/dist/docs/` before changing Next.js-specific APIs, once dependencies are installed.
- Follow the package scripts and existing code conventions in the relevant app. Do not assume the root directory is a functioning pnpm workspace until workspace configuration is fixed and verified.
- For schema changes, add ordered, additive database migrations. Document backfills, rollback considerations, and affected routes.
- Update the appropriate docs when a durable architecture decision, product behaviour, or task status changes.

## Privacy and data handling

- Treat client-provided ZIPs, spreadsheets, certificates, transcripts, essays, CVs, recommendation letters, signatures, and applicant profiles as private.
- Do not commit the client's raw archive or personal documents. Do not copy them into public assets, screenshots, fixtures, issue descriptions, prompts, or logs.
- Use synthetic, clearly fictional data for tests, seeded demos, screenshots, and portfolio material.
- Keep shared catalogue facts separate from user-owned notes, application states, and document metadata.
- Never expose secrets or private environment files. Never put a service credential or third-party API key into browser code.
- Any web URL import must validate the URL and redirect targets, bound time and response size, rate-limit requests, and reject private/internal network destinations to mitigate SSRF.
- User-owned records and files must be authorized server-side on every operation. UI guards are not authorization.

## Product correctness

- Prefer official scholarship/university/government/provider sources for deadlines, funding, eligibility, language tests, and application links.
- Keep source URL, source type, last-checked timestamp, evidence, intake applicability, and verification status for material research facts.
- AI output is a draft or explanation, not official evidence. Unknown/conflicting facts remain unknown/conflicting until reviewed.
- Distinguish hard eligibility rules from profile-fit ranking. Never describe a fit score as admission probability.
- Do not call a scholarship “fully funded” unless the covered expense components and conditions support that claim.
- Support multiple nationalities, education systems, degree levels, intakes, and countries. Do not hardcode the initial applicant's personal profile as global business logic.

## Quality gates

For applicable web changes, run and report the actual outcomes of:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Add or update focused tests for changes. Run browser-level tests when available. If dependencies, credentials, external services, or device access prevent a check, state that plainly—never claim a test passed if it was not run.

For data isolation, test at least two independent users and confirm that changing a record ID cannot read, modify, or delete another user's data. For source import/change detection, test redirects, timeouts, malformed pages, conflicting values, and failed fetches.

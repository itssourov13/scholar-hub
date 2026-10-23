# Production Database Target and Migration Runbook

_Last verified: 2026-10-23. No production schema or data writes have been made._

## Decision

Use Neon **AWS Asia Pacific 1 (Singapore), `aws-ap-southeast-1`** for the primary database. The primary audience is in Bangladesh; Singapore is the chosen nearby supported region, and the web server-side functions are configured for Vercel `sin1` so database-backed requests do not default to a US function region.

The target is the existing Neon project **ScholarHub Production Singapore**:

- Project ID: `shy-darkness-67521294`
- Region: `aws-ap-southeast-1` (Singapore)
- Intended production branch: `br-divine-grass-a16og13f` (`production`, default/primary)
- Database: `neondb`

Do not use the local `DATABASE_URL` as Vercel's production value: both local environment files currently resolve to the **staging** branch `br-nameless-fog-a10fo0rl`. Never paste a database URL or password into documentation, logs, Git, or chat.

## Read-only evidence matrix

| Candidate | Region / branch | Observed state | Decision |
|---|---|---|---|
| `ScholarHub Production Singapore` — `shy-darkness-67521294` | `aws-ap-southeast-1` / production `br-divine-grass-a16og13f` | The production branch's `neondb` has zero public application tables. | **Chosen production project.** Schema still needs an approved migration. |
| Same project | Singapore / staging `br-nameless-fog-a10fo0rl` | 14 public tables; 94 scholarship records, all draft/unverified; 0 published, 0 live, 0 RAG documents. Local `DATABASE_URL` resolves here. | Staging only. Never point Production at this branch. |
| Same project | Singapore / preflight `br-holy-cell-a1qlrlmy` | Temporary isolated child of production. Baseline migrations `018`–`028` were tested here; 14 public tables, expected schema fields, pgvector extension and `match_scholarship_docs` function verified; 0 scholarship/RAG rows. | Preflight evidence only; not the production database. Keep until the production migration decision is completed. |
| `ScholarHub` — `calm-poetry-87067538` | `aws-us-east-2` / production `br-floral-sunset-b49utafc` | Empty production branch; wrong region for the approved first-release target. | Not selected. |
| Vercel | Authenticated Vercel workspace | Project list returned no projects; `scholar-hub` lookup returned not found. | No Production environment exists in the connected Vercel scope to configure yet. |

## Schema preflight

The clean preflight branch was tested using the existing baseline `apps/web/supabase/migrations/018_neon_migration.sql` and current additive migrations `019`–`028`, including the scholarship slug/live fields, CV tables, push state, roadmap, Bangladeshi eligibility, and import provenance.

Verified on `br-holy-cell-a1qlrlmy`:

- PostgreSQL 18.6.
- 14 public application tables.
- `vector` extension and `match_scholarship_docs` function exist.
- Scholarship schema has the required five fields checked for this release: `slug`, `required_documents`, `source_dataset`, `source_record_id`, and `source_verification_status`.
- Zero scholarships and zero `ScholarshipDoc` rows. No staging records were copied into this branch.
- Schema comparison against staging showed only the position/order of the `slug` column differs; the column and its partial unique index exist. Column ordering does not change the named-column application queries used by this app.

The historical files include duplicate `004` and `007` prefixes and older Supabase-specific migrations. Do **not** replay `001`–`017` as an indiscriminate numbered sequence against Neon. For a fresh empty Neon branch, `018` is the current Clerk/Neon baseline and `019`–`028` are its later additive changes. Check this sequence against source and the tested preflight branch before execution.

## Production migration procedure

Production currently has zero public application tables. The schema must be created before the web app can use the production DB, but this is a production schema write and must be explicitly approved before execution.

1. Keep the preflight branch and its evidence; verify the production branch still has zero application tables immediately before the change.
2. Take/confirm an available recoverable Neon restore point or snapshot and record the rollback procedure. There is no production app data to migrate at the moment, but the empty branch must not be replaced without checking its state again.
3. Apply the tested `018` baseline followed by `019`–`028` to **only** `br-divine-grass-a16og13f`, within a controlled maintenance window/transaction where supported. Do not migrate or import staging records as part of schema setup.
4. Run schema/table/function/extension smoke checks and verify key application queries against production.
5. Only after a Vercel project is linked, configure its encrypted Production `DATABASE_URL` from the production branch endpoint; confirm the branch ID in Neon first. Preview must use a distinct staging value.
6. Deploy to Preview first, then run approved web/API/auth smoke tests. Do not promote until the deployed environment is proven to use the intended production branch.
7. Keep the 94 staging candidates unverified; do not copy or publish them automatically. Official-source review and the admin publish gate are separate release gates.

**Current blocker:** the schema baseline passed on an isolated preflight branch, but it has **not** been applied to production. The connected Vercel workspace has no ScholarHub project, so its environment variables and deployment cannot yet be set. Ask for explicit approval before executing the production schema migration.

# Vercel Deployment Guide

_Status (2026-10-24): the existing Production URL is live and public APIs read 5 scholarships + 5 guides from Singapore Production. PR #6 Preview build currently fails during page-data collection for `/api/admin/guides/[id]/cover` because Preview `DATABASE_URL` is not configured (per the user-provided Vercel build log). The connected Vercel tool scope lacks permission to inspect project settings directly. The branch's verification-gate/metadata changes are not in Production; the visible index HTML still has stale content._

## Vercel project settings

In the existing Vercel project connected to `itssourov13/scholar-hub`, confirm these project settings:

- **Root Directory:** `apps/web`.
- **Framework:** Next.js (also declared in `apps/web/vercel.json`).
- **Node.js:** `22.x`. `apps/web/package.json` requires Node `>=22 <23`.
- **Include source files outside of the Root Directory in the Build Step:** enabled. The web TypeScript config references the type-only source file at `packages/shared/src/types.ts`; the build must be allowed to read that file outside `apps/web`.
- **Output Directory:** leave at the Next.js default; do not override it to `.next` or `apps/web/.next`.
- **Function Region:** `sin1` (Singapore), declared in `apps/web/vercel.json`. The selected Neon production project is in `aws-ap-southeast-1` (Singapore); keeping server-side functions near Neon reduces database round-trip time. Vercel static assets are still served through its global CDN. Confirm the effective region in the Vercel dashboard after importing the project and deploying.
- **Corepack:** add the non-secret Environment Variable `ENABLE_EXPERIMENTAL_COREPACK=1` to the build environments. The Vercel config calls `corepack pnpm`, and `apps/web/package.json` pins `pnpm@11.1.3`.
- Do not set `SCHOLARHUB_LOCAL_PREVIEW=1` in Vercel.

The Vercel configuration uses a frozen lockfile install and the existing web `build` script. This prevents deployment-time dependency resolution from silently changing the lockfile.

## Environment variables

Add the values in Vercel **Settings → Environment Variables**. Keep private credentials as Sensitive/Encrypted values where available, never in source files, client-side variables, or Git. The database targets and preflight evidence are recorded in [Production Database Target](PRODUCTION_DATABASE.md).

### `DATABASE_URL` environment mapping (required)

Use a distinct environment-scoped value for each deployment type; never share one `DATABASE_URL` across Preview and Production:

| Vercel environment scope | Database target | Neon branch | Setup status (2026-10-24) |
|---|---|---|---|
| **Preview only** | Staging `neondb` | `br-nameless-fog-a10fo0rl` | **Not configured / redeploy pending.** The user-provided PR #6 build log reports `DATABASE_URL is not configured` while collecting configuration for `/api/admin/guides/[id]/cover`. |
| **Production only** | Production `neondb` | `br-divine-grass-a16og13f` | The existing live public APIs return the 5 scholarships and 5 guides in Production. The variable value itself has not been independently inspected through the connected Vercel tool scope. |

For Preview, copy the connection string from the Neon Staging branch and select **Preview** only in Vercel. For Production, use the Production branch connection string and select **Production** only. Do not store the literal connection strings in this guide or any Git-tracked file. After adding the Preview variable, redeploy the failed Preview deployment; deployments created before a variable change do not receive the new value. Staging currently has 94 draft/unverified scholarships and no guides, so a successful Preview may show no published scholarship/Guide content until reviewed test records are intentionally seeded there. The existing Production database contains five published verified scholarships and five published guides.

### Required for a functioning web application

- `DATABASE_URL`: a real, intended Neon/PostgreSQL database connection string. Confirm the target database and its schema/data before choosing it for production.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`: credentials from the intended Clerk application/environment.
- `NEXT_PUBLIC_SITE_URL`: the final HTTPS Vercel URL or custom domain used for the deployment.

### Enable only when the relevant integrations are ready

- `CLERK_WEBHOOK_SECRET`: required to validate the Clerk webhook at `/api/webhooks/clerk` when the webhook is configured.
- `OPENROUTER_API_KEY`: required for AI mentor/summarisation features.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`: required for Cloudflare R2-backed media/storage operations. Configure `NEXT_PUBLIC_R2_PUBLIC_DOMAIN` if assets will use a public/custom R2 domain.
- `FCM_SERVICE_ACCOUNT`: server-only Base64-encoded JSON for the matching Firebase project's service account. Never use the mobile `google-services.json` for this variable and never prefix it with `NEXT_PUBLIC_`.
- `CRON_SECRET`: a strong random secret configured in Vercel Production. The daily Vercel Cron calls `/api/cron/push-digest` with `Authorization: Bearer $CRON_SECRET`. Generate a separate production value (for example, locally with `openssl rand -base64 32`) and do not reuse/publish the local value.
- `REDIS_URL`: recommended for shared production rate-limiting state; without it, some rate limits fall back to per-instance memory.
- `NVIDIA_API_KEY`: optional for admin parsing/enrichment paths configured to use NVIDIA NIM.

Other model labels, fallback models, redirect paths, support/contact links, and analytics values are configurable through the root `.env.example`. Configure only the integrations the release will actually offer. Never paste credentials into issue trackers, documentation, or chat.

## Cron behaviour

`apps/web/vercel.json` schedules `/api/cron/push-digest` at `0 3 * * *` UTC (09:00 in Dhaka, daily). Vercel Cron jobs run against Production deployments, not Preview deployments. The route itself verifies the Bearer secret and declares a 60-second maximum duration. Check the Cron Jobs page after a successful production deployment.

## Deployment sequence

1. In the existing Vercel project, confirm the settings above (`apps/web` root, Node 22.x, outside-root source access, Corepack, and Singapore Function Region).
2. Configure environment variables using the mapping above. In particular, add `DATABASE_URL` for **Preview only** using Neon Staging `br-nameless-fog-a10fo0rl`; do not use the Production connection string in Preview. Keep the Production `DATABASE_URL` scoped to Production and pointing to `br-divine-grass-a16og13f`.
3. Redeploy PR #6 Preview after saving the missing variable. Confirm the build passes page-data collection and then smoke-test public pages, database-backed APIs, Clerk authentication, AI, admin storage, and notification configuration. Distinguish expected empty Staging listings from build/runtime failures.
4. Before merging/deploying this branch, confirm the Production database is still the intended populated database (five verified scholarships, five guides), that RAG gates/embeddings behave as intended, and that authorization checks have been exercised with separate users. Schema existence alone is not a release check.
5. Merge/promote/deploy Production only after explicit approval. Confirm the HTTPS URL, then update `NEXT_PUBLIC_SITE_URL` and redeploy if the URL changed. Revalidate `/guide`, `/scholarships`, and changed detail pages after deploy; cached HTML may remain stale until a new build or authenticated revalidation.
6. Verify Vercel Cron registration and run an approved, non-broadcast smoke test. Do not test broadcasts against real users without explicit approval.

## Local verification completed

- On `audit/production-neon-target`, Node 22.23.1 / pnpm 11.1.3 verification passed lint, typecheck, all 388 tests across 21 files, and the Next.js Webpack production build (56 static pages/routes). Build warning: custom Cache-Control for `/_next/static/:path*` may affect development caching; this is a pre-existing non-blocking warning. `git diff --check`, `vercel.json` JSON validation and Markdown local-link checks also passed. No hosted Vercel deployment was run.
- `apps/web/vercel.json` is valid JSON and preserves the daily push-digest schedule.
- The local FCM service-account is stored outside Git, and its Base64 environment value is round-trip validated without exposing its contents.
- The Production migration was verified on 2026-10-23 (14 tables, 31 indexes, pgvector/RAG match function; at that checkpoint there were 0 scholarship rows, 0 RAG docs and 0 guides). A separate Phase 1 write on 2026-10-24 populated 5 verified scholarships and 5 guides, with 0 embeddings. Local build checks do not establish a successful new Vercel build, full credential validity or real-device push delivery.

## Post-deployment content smoke test — 2026-10-24

Against `https://scholarhub-itssourov13.vercel.app`, `/api/scholarships` and `/api/guides` returned HTTP 200 with five rows each; all ten detail URLs returned HTTP 200 with expected H1s. The static `/scholarships` and `/guide` index HTML returned HTTP 200 but still does not contain the new item titles. It also retains the old `300+` metadata; the cached KAIST detail page still says `Full funding` while the database/API says `partial`. Read-only Neon checks independently confirmed the populated Singapore `production` branch `br-divine-grass-a16og13f` in `neondb`. Connected Vercel scope still has no project settings entry, so env vars were not directly inspected. A new Production build/deploy or authenticated revalidation is required before marking the visible collection pages current. No deploy/revalidation endpoint was called.

# Vercel Deployment Guide

_Status: deployment configuration prepared locally; no Vercel project has been linked or deployed from this workspace._

## Vercel project settings

Import `itssourov13/scholar-hub` in the intended Vercel account and configure these values before the first production deploy:

- **Root Directory:** `apps/web`.
- **Framework:** Next.js (also declared in `apps/web/vercel.json`).
- **Node.js:** `22.x`. `apps/web/package.json` requires Node `>=22 <23`.
- **Include source files outside of the Root Directory in the Build Step:** enabled. The web TypeScript config references the type-only source file at `packages/shared/src/types.ts`; the build must be allowed to read that file outside `apps/web`.
- **Output Directory:** leave at the Next.js default; do not override it to `.next` or `apps/web/.next`.
- **Corepack:** add the non-secret Environment Variable `ENABLE_EXPERIMENTAL_COREPACK=1` to the build environments. The Vercel config calls `corepack pnpm`, and `apps/web/package.json` pins `pnpm@11.1.3`.
- Do not set `SCHOLARHUB_LOCAL_PREVIEW=1` in Vercel.

The Vercel configuration uses a frozen lockfile install and the existing web `build` script. This prevents deployment-time dependency resolution from silently changing the lockfile.

## Environment variables

Add the values in Vercel **Settings → Environment Variables**. Keep private credentials as Sensitive/Encrypted values where available, never in source files, client-side variables, or Git.

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

1. Import the repository and set the project settings above.
2. Add/validate environment variables before deploying. Do not deploy with a placeholder or dummy `DATABASE_URL`.
3. Build from a preview branch first if one is available. Review build logs and smoke-test public pages, database-backed APIs, Clerk authentication, AI, admin storage, and notification configuration.
4. Confirm the Production database is the intended populated database and that authorization checks have been exercised with separate users before sending live traffic.
5. Promote/deploy Production, confirm the generated HTTPS URL, then update `NEXT_PUBLIC_SITE_URL` and redeploy if the URL changed.
6. Verify Vercel Cron registration and run an approved, non-broadcast smoke test. Do not test broadcasts against real users without explicit approval.

## Local verification completed

- The local web lint, typecheck, 379 unit tests, and Next.js Webpack production build passed on 2026-10-23.
- `apps/web/vercel.json` is valid JSON and preserves the daily push-digest schedule.
- The local FCM service-account is stored outside Git, and its Base64 environment value is round-trip validated without exposing its contents.
- These checks do not establish a successful Vercel build, valid production credentials, a populated production catalogue, or a real device push delivery. Those require the intended Vercel account, provider values, and deployment/runtime verification.

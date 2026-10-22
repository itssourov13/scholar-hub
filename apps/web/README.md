# ScholarHub web application

The web app and API handlers live here. The canonical product context and architecture are maintained at the repository root:

- [Project README](../../README.md)
- [Agent instructions](../../AGENTS.md)
- [Current state](../../docs/CURRENT_STATE.md)
- [Architecture](../../docs/ARCHITECTURE.md)
- [Task state](../../docs/TASK_STATE.md)

## Scripts

Defined in this package:
- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

The dependency/workspace setup still needs a verified baseline. Consult the handoff before assuming installation or builds work.

## Local visual-only preview

`SCHOLARHUB_LOCAL_PREVIEW=1` is only for local UI inspection when real Clerk credentials are not configured. Set it for both the production build and the `next start` process so the compiled application and request proxy agree. In this mode:

- Public UI uses a signed-out guest auth context, without loading the Clerk client SDK on public pages.
- `/auth/*` routes redirect to `/?preview=auth-disabled`; login, sign-up, and Google auth are not available.
- The proxy bypasses Clerk middleware for the local preview only. **Never enable this flag in Vercel, production, or an untrusted/shared environment.** Production must use the normal Clerk middleware and real provider credentials.
- The browser removes existing service-worker registrations and old `scholarhub-*` caches during preview load. Normal service-worker cache version is `v6`.
- A dummy `DATABASE_URL` can be used only to check UI/build paths that tolerate database failures. It does not create or populate data; the build may log Neon errors and database-backed content may be empty. Use a dedicated real Neon test/staging database, apply the reviewed migrations, and import/verify published scholarship records to test real content. Do not point an importer at a dummy URL or production data without a backup/review.

After building and starting in this mode, verify the rendered page in a real browser and its Network panel; `curl`/HTTP 200 alone will not detect a browser redirect to an unresolved Clerk host. For a regular production-like verification, unset `SCHOLARHUB_LOCAL_PREVIEW` and use configured test credentials/services.

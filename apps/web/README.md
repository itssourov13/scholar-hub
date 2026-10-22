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

For a local preview without configured Clerk credentials, set `SCHOLARHUB_LOCAL_PREVIEW=1` for both the production build and server process. The public UI runs as a signed-out guest, and `/auth/*` routes return to the public homepage; this mode does not authenticate users or bypass server-side API authorization. **Do not set this flag in Vercel or any production deployment.** A real deployment must build and run with this flag unset and with valid Clerk credentials configured.

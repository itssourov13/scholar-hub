# Web app instructions

Read the repository-root `AGENTS.md` and the current canonical docs in `docs/` before substantial changes.

This app currently uses Next.js 16 App Router and React 19. **Before writing or changing Next.js-specific code, read the relevant version-matched guide in `node_modules/next/dist/docs/` once dependencies are installed.** Do not assume older Next.js APIs or conventions still apply; heed the installed version's deprecation notes.

Prefer targeted changes and preserve existing UI/animation behaviour unless the task explicitly requests a redesign. The web app also hosts current API route handlers consumed by the Expo mobile client, so check shared API contracts and mobile compatibility before changing responses.

Never put secrets in client bundles. API routes must verify identity server-side and scope every private record operation to the authenticated owner. Update tests and canonical docs when behaviour changes.

# Architecture

_Last reviewed: 2026-10-23. Existing implementation is separated from the intended ScholarHub target so planned capabilities are not mistaken for current behaviour._

## 1. Current architecture

The repository currently uses a Next.js web application that owns both UI routes and server API handlers, a separate Expo mobile client, a shared PostgreSQL database, and external AI/storage/auth services.

```text
Web browser / PWA                 Expo / React Native app
       |                                    |
       +-------------- HTTPS API -----------+
                           |
                    Next.js App Router
                 UI pages + /api route handlers
                           |
           +---------------+-------------------+
           |               |                   |
         Clerk            Neon              Cloudflare R2
      authentication   PostgreSQL          object storage
           |          + pgvector                 |
           |               |                 thumbnails/assets
           +---------------+
                           |
                OpenRouter / optional NIM
                chat, embeddings, admin AI
                           |
                 Optional Redis rate limits
```

Observed stack:
- Web: Next.js 16 App Router, React 19, TypeScript, CSS Modules.
- Auth: Clerk on web and Expo.
- Database: Neon Serverless PostgreSQL with pgvector.
- Object storage: Cloudflare R2 using the S3-compatible API.
- AI: OpenRouter for chat/embeddings; optional NVIDIA NIM for selected admin tooling.
- Rate limits: Redis integration with a process-local fallback.
- Web deployment: Vercel configuration and a deployment guide are prepared, but no Vercel project has been linked from the intended account and no hosted deployment has been verified. The canonical production Neon project/branch remains unresolved; see `docs/SCHOLARSHIP_DATA_IMPORT.md` and the local-only `report.md`.
- Native client: Expo SDK 57/React Native 0.86.

The existing request path is API-centric. Personal record ownership is primarily enforced through server handlers that derive the caller from Clerk and include the caller's ID in queries. Do not assume PostgreSQL RLS is currently the active authorization boundary.

## 2. Current major domain areas

- Scholarship catalogue and detail records.
- Scholarship administration and AI-assisted parse/enrich/ingest.
- User profiles and eligibility/match features.
- Bookmarks and tasks.
- AI mentor sessions/messages and vector retrieval.
- Personalised study-abroad roadmap.
- CV records and analysis.
- Guides and their administration.
- Notifications/push-related operations.
- Mobile API client and shared TypeScript contracts.

## 3. Target ScholarHub domains

Implement these as logical modules, not as an immediate microservice split:

### Public research catalogue
- Institutions, programmes, opportunities/intake cycles.
- Funding components and conditions.
- Eligibility rules and supported qualification systems.
- Official sources, source snapshots, field evidence, verification state, and change events.
- Moderation and correction suggestions.

The current `scholarships` table remains the starting point. Prefer additive migrations and adapters over a destructive rename or full database replacement.

### Private applicant workspace
- Applicant profile/preferences.
- Saved opportunities and private notes.
- Application records, status history, personal deadlines, and decision metadata.
- Application-specific requirement checklists and tasks.
- Document metadata, versions, and which version was used for which application.
- Essay/SOP library and user-owned drafts.

Each application and private record must be scoped to its owner on every read/write/delete operation.

### Research ingestion and verification
- Provider-neutral search adapter.
- Secure public URL fetcher and text/PDF parsing where allowed.
- Validated extraction drafts linked to evidence.
- Review queue for material facts and conflicts.
- Recheck scheduler, snapshots/diffs, retries, and stale-source status.

AI may suggest candidate fields and summaries; it cannot mark a source verified merely because its response sounds confident.

### Offline and synchronization
- Service worker for the versioned app shell/static assets.
- IndexedDB/Dexie local records for deliberately supported offline workflows.
- A durable outbox for edits made offline.
- Stable mutation IDs and idempotency on sync operations.
- Revision/version checks with an explicit conflict-resolution path.
- Visible offline/queued/syncing/error/last-success states and manual Sync Now.
- No caching of authentication responses, private API data, or private documents in a general shared cache.

## 4. Data flow

### Public opportunity update
1. Discover a candidate via a permitted search/API/feed/manual URL.
2. Fetch and parse within strict limits.
3. Validate extracted data against typed schemas.
4. Store the source and an unverified extraction draft.
5. Show evidence, changed values, missing values, and conflicts to a reviewer.
6. Publish/accept the material change only after the configured review rule.
7. Record before/after values and update verification timestamps.
8. Revalidate public pages/cache where needed.

A timeout, redirect error, parse failure, or empty page never means “closed” or “not eligible”.

### Personal application update
1. Identify the caller from a verified Clerk session/token.
2. Validate request body and operation.
3. Scope the database query to the caller's identity and resource ownership.
4. Persist the change or enqueue a local mutation when offline.
5. Synchronize idempotently and expose failures/conflicts.
6. Keep private state separate from catalogue refreshes.

## 5. Data and service boundaries

| Boundary | Rule |
|---|---|
| Public catalogue vs user data | Separate tables/ownership and separate APIs where practical |
| Browser vs secrets | No database credentials, Clerk secret, R2 secret, or AI provider key in client bundles |
| Public assets vs private documents | Existing public thumbnail CDN is not a private-document store |
| AI extraction vs accepted facts | AI creates drafts; source evidence and review control acceptance |
| Offline cache vs authenticated data | Never serve one user's private response to another user or across sign-out |
| Web vs mobile | Keep API request/response contracts in the shared package where practical |

## 6. Multi-user authorization requirements

- Derive identity server-side from the verified Clerk session or Bearer token; do not trust a body-supplied `user_id`.
- For each record endpoint, verify that the row belongs to the caller or that the caller has an explicit shared/admin permission.
- Use owner-scoped `SELECT`, `UPDATE`, and `DELETE` queries; check affected-row counts and return consistent 404/403 responses.
- Audit every use of privileged database credentials. Keep privileged credentials server-side.
- Protect admin endpoints on the server as well as in the UI.
- Add two-user integration tests that attempt to access, change, and delete each other's records.
- Add rate limits and resource-size limits to expensive AI, search, parse, and upload endpoints.

## 7. Safe URL import requirements

Any user-supplied URL fetcher is an SSRF-sensitive component. It must:
- Allow only HTTP/HTTPS and expected ports.
- Resolve and reject loopback, private, link-local, reserved, and internal destinations.
- Revalidate every redirect target and defend against DNS rebinding.
- Enforce request timeout, redirect count, response byte limit, content-type allowlist, and per-user/global rate limits.
- Avoid sending the user's cookies or internal credentials to the destination.
- Treat all external page text as untrusted input; never allow page content to change system instructions or server behaviour.
- Respect source terms, robots guidance where applicable, and access controls; do not bypass anti-bot/login gates.

## 8. Existing architecture risks to address

1. Product copy, metadata, PWA/native labels, slug/scheme, and shared package scope were updated; the old APK and assetlinks were removed and legacy ad/pixel code was disabled. Native IDs are set to `com.scholarhub.app` for the intended separate ScholarHub listing; store registration/update compatibility remains unverified. Matching Firebase configuration (if push is in scope), EAS/local signing setup, legacy artwork and deployment credentials still require release review.
2. Root pnpm workspace/dependency configuration is inconsistent or incomplete; validate installation before changing it.
3. Historic architecture documents conflicted with the actual Clerk/Neon/R2 implementation.
4. Offline support currently centres on the app shell, not durable offline application workflows.
5. Raw SQL handlers require consistent, tested object-level authorization.
6. Research facts lack a complete field-level provenance and change-review pipeline.
7. Root contains tracked historical exports/dumps that must be reviewed before any public source release.
8. A future private document vault needs separate storage access controls and threat-model review.

## 9. Evolution strategy

Keep the existing application working and extend it incrementally:
1. Stabilise docs, build/test tooling, and capture a verified baseline.
2. Complete a source/brand/environment inventory.
3. Define additive schema changes and map the client's workbook in a staging import.
4. Add structured source evidence and accurate funding/eligibility semantics.
5. Deliver the application tracker and offline local persistence.
6. Add source verification/change detection.
7. Strengthen sync, privacy, authorisation, and release controls.
8. Expand audience, subject/degree coverage, and mobile parity once the core is reliable.

Do not split services or replace the database/auth provider without measurements or a documented decision.

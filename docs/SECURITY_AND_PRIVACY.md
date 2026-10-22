# Security and Privacy

_Last reviewed: 2026-10-23. This is a design/inspection checklist, not a completed security audit._

## 1. Data classes

| Class | Examples | Default handling |
|---|---|---|
| Public research | Published scholarship facts, official URLs, institution metadata | Catalogue data with provenance and review state |
| Internal research workflow | Raw imports, unreviewed extracted drafts, change queues | Restricted staff/admin access |
| Personal applicant data | Profile, goals, grades/qualifications, private notes, application statuses, essays | Owner-only access |
| Sensitive documents | Passport/ID, birth certificate, transcripts, signed forms, recommendation letters | Local-only by default; separate consented private storage if introduced |
| Credentials | Database/Clerk/R2/AI/Redis tokens, signing keys, webhook secrets | Secret manager/environment only; never log or commit |

## 2. Supplied archive handling

The supplied archive includes personal applicant materials as well as scholarship research resources. Treat the whole archive as private until each file is classified.

- Preserve source originals; work on a separate copy for transformations and imports.
- Keep original high-resolution scans untouched.
- Import catalogue facts separately from applicant documents.
- Never use personal files in public thumbnails, test fixtures, demo accounts, portfolio screenshots, or public LLM prompts.
- Avoid uploading personal documents to cloud/AI services by default. If a feature requires it, obtain explicit informed consent and explain provider, purpose, retention, deletion, and alternatives.
- Use synthetic applicant/test data for CI and public demos.
- Export and delete must be supported for user-owned data.

## 3. Local credentials and ignore rules

The mobile `.gitignore` excludes the package-specific `android/app/google-services.json`, optional local `android/keystore.properties`, the local upload keystore, Android/Gradle build output, common credential/certificate formats (`*.jks`, `*.keystore`, `*.p8`, `*.p12`, `*.key`, `*.mobileprovision`), local `.env*.local`, Metro health-check files, debug logs, macOS `.DS_Store`, and patch leftovers. These rules are repository hygiene/safety measures, not runtime requirements.

The generic rules remain alongside explicit ScholarHub paths because changing product identity or using local preview does not remove the risk of accidentally committing signing material. `google-services.json` must be generated for `com.scholarhub.app` if Firebase Android services/push are used; do not commit it. EAS-managed remote signing does not require local `keystore.properties`, while a deliberately configured local signing build may. The root `.gitignore` also excludes env files, service-account JSON, local database export and audit output.

Important limitation: `.gitignore` prevents normal tracking of untracked files; it does not untrack an already committed file or clean Git history. Verify with `git check-ignore -v <path>` and `git ls-files <path>`. Broad extension rules can catch legitimate source assets, so explicitly allow a legitimate source file when one is intentionally required rather than removing credential protection.

## 4. Existing repository exposure review

Initial repository listing showed tracked historical JSON exports/logs, a generated repository dump, and former product documentation. Their contents have not been fully audited in this pass. Before publishing source code or opening the repository to a wider audience:
1. Inspect these artifacts for emails, names, private messages, auth tokens, environment values, URLs that reveal private systems, and client information.
2. Delete artifacts not required for reproducible development; where sensitive content reached Git history, assess history cleaning and rotate any exposed secrets.
3. Keep exported conversation logs and full repository dumps out of the release.
4. Confirm ignore rules cover private environment files, local exports, screenshots, raw ZIPs, and generated artifacts.

## 5. API and multi-user authorization

The current app uses Clerk identity and server-side SQL against Neon. Therefore:
- Derive user identity from a verified auth context; never trust a client-supplied owner ID.
- Scope all user-owned reads/writes/deletes to the authenticated owner or a documented share permission.
- Protect admin APIs server-side. A hidden button or route guard does not protect data.
- Test cross-user ID substitution across profiles, tasks, bookmarks, chat sessions, CVs, documents, and applications.
- Check affected-row counts and avoid returning another user's records through joins, counts, logs, or caches.
- Apply rate limits and size/timeout caps to chat, semantic matching, imports, parsing, uploads, and expensive providers.
- Validate all inputs with explicit schemas and bound every query parameter.

## 6. URL import, crawling, and AI safety

A server-side URL importer must mitigate SSRF and untrusted page content:
- Accept only HTTP/HTTPS, validate destination host/IP, block loopback/private/link-local/internal ranges, and revalidate redirects.
- Limit redirects, wall-clock time, response bytes, content types, and per-user/global request volume.
- Do not forward authentication cookies or internal credentials to source sites.
- Respect source terms, applicable robots guidance, rate limits, and access controls; do not bypass gated content.
- Treat webpage content as untrusted data, not instructions for the AI, tools, or server.
- Store short evidence excerpts/section references and metadata rather than wholesale page copies where possible.
- Keep raw model output as a draft; validate against schemas and show evidence before accepting material claims.

## 7. PWA and offline security

- Cache versioned static assets and explicitly selected public app-shell routes.
- Do not store authenticated API responses or document blobs in a generic shared cache.
- Clear user-specific in-memory state on sign-out and make account switching safe.
- Scope IndexedDB records to a user identity; account switching must never expose another account's local data.
- Use an outbox with idempotency, revision checks, and recoverable conflicts.
- Explain that IndexedDB is not automatically encrypted and can be exposed by a compromised same-origin script or device.
- Private cloud documents require a private bucket, narrowly scoped authorization, short-lived access URLs, size/type checks, and deletion behaviour; the existing public asset CDN is not a private vault.

## 8. Local visual-preview boundary

- `SCHOLARHUB_LOCAL_PREVIEW=1` is a developer-only visual-preview switch, not a login/test-auth implementation. It bypasses Clerk middleware in the local proxy and makes `/auth/*` unavailable by redirecting to the public homepage.
- Do not set this flag in Vercel, a production deployment, or a publicly reachable shared environment. Production must use the normal Clerk middleware, real Clerk keys, the real `DATABASE_URL`, and credentials-backed smoke tests.
- The preview's dummy database URL only allows compilation/rendering to be inspected while database reads fail/fall back. It does not seed scholarship records, prove migration success, or validate private-data authorization.
- The preview clears prior service-worker registrations/cache entries on its browser-side load. This is a local inspection aid and must not be treated as an account/data deletion mechanism.

## 9. Release gates

Before a public release:
- Complete a threat model and focused OWASP ASVS/API-security checklist.
- Verify auth and authorization with at least two separate users.
- Test malformed imports, SSRF cases, redirects, timeouts, oversized files, and provider failures.
- Run dependency and secret scanning.
- Verify logging does not include private document contents, tokens, or entire applicant profiles.
- Confirm privacy notice, terms, retention/deletion, export, incident contact, and target-market legal review.
- Run accessibility, responsive, offline, performance, and production deployment smoke tests.

No item in this document should be considered completed until test evidence or a dated review is recorded.

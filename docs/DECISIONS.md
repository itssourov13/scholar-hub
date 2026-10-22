# Decisions

_Last reviewed: 2026-10-23_

This is the durable decision log. A decision labelled **Accepted** is the current working direction; it may be superseded only by a documented change with its reason and migration impact.

## ADR-001 — Product name is ScholarHub
**Status:** Accepted

All new product documentation and primary labels use **ScholarHub**. The workspace path remains as-is. Primary copy/metadata/PWA/native labels, Expo slug/scheme, Android deep-link scheme, and the shared TypeScript package scope have changed. Android/iOS identifiers are set to `com.scholarhub.app` for the intended separate ScholarHub listing; store registration/update compatibility and signing remain unverified. Legacy artwork, actual legal/operator details, production domain, OAuth, push configuration, Firebase settings (if push is in scope), and deployment credentials still require deliberate migration. Store/social/support destinations are configuration-driven and unset by default.

**Reason:** Establish one product identity without accidentally breaking existing installations or integrations.

## ADR-002 — Evolve the current workspace; do not start over
**Status:** Accepted

Continue in the existing repository at `/home/kali/gpt-workspace/BairePorbo`. Reuse the working Next.js app, API handlers, auth, PostgreSQL data layer, AI retrieval, admin tooling, and Expo client where they fit.

**Reason:** The repository already implements a large portion of the discovery and guidance experience. A greenfield rewrite would duplicate effort and raise migration risk.

## ADR-003 — Keep the existing main stack for the first implementation increments
**Status:** Accepted

Keep Next.js/React/TypeScript for web and API, Clerk for identity, Neon/PostgreSQL/pgvector for data, Cloudflare R2 for current public assets, OpenRouter for existing AI paths, and Expo/React Native for the mobile app unless a measured requirement or documented risk justifies a change.

**Reason:** Replacing infrastructure at the same time as the product is being rebranded would multiply failure modes. Current dependency/workspace configuration still needs verification.

## ADR-004 — Separate public research from private applicant workflow
**Status:** Accepted

Public opportunities, institutions, source evidence and review history are separate in purpose from private profiles, notes, application states, essays, tasks and documents. Public source refresh must never overwrite user-owned state.

**Reason:** Enables wider catalogue reuse while protecting applicant privacy and preventing data corruption.

## ADR-005 — Build offline-first behaviour incrementally
**Status:** Accepted

Do not claim full offline-first support today. Start with an explicit list of offline-supported records and operations, local persistence, an outbox and visible manual sync. Add background sync only as a progressive enhancement.

**Reason:** The existing service worker provides shell/offline fallback behaviour; application data persistence and conflict resolution need implementation and tests.

## ADR-006 — Official evidence outranks AI-generated content
**Status:** Accepted

Search snippets and AI outputs are discovery/extraction aids, not final authority for deadlines, eligibility, test requirements or funding. Preserve provenance, uncertainty and review state. Material changes are reviewable and must not silently overwrite accepted facts.

**Reason:** Incorrect information can cause a user to miss deadlines or waste money.

## ADR-007 — The client archive is an import source, not repository content
**Status:** Accepted

Preserve the archive originals. Inspect and import from a separate copy. Public catalogue rows may be imported only with provenance and appropriate review. Private profile documents are not to be placed in the source repository, public assets, or demo seed data.

**Reason:** The archive contains both research material and sensitive applicant-specific documents.

## ADR-008 — API-level ownership checks are mandatory
**Status:** Accepted

The current Neon-based server access path does not rely on Supabase RLS as its active authorization layer. All personal-data routes must verify the caller and scope each operation to the owning user or an explicit permission.

**Reason:** Authentication alone does not prevent broken object-level authorization.

## ADR-009 — No immediate microservices split
**Status:** Accepted

Use modular domains and clear boundaries inside the current app. Do not activate/rebuild the empty `apps/api` scaffold or split the backend without a clear need, performance evidence, and an implementation/operational plan.

**Reason:** The current Next.js API is already used by the web and mobile clients.

## ADR-010 — Do not make public-release claims before evidence exists
**Status:** Accepted

Do not describe ScholarHub as fully rebranded, production-ready, fully offline, globally comprehensive, or security-audited until the corresponding changes and tests are complete.

**Reason:** Product and engineering claims must match verified behaviour.

## ADR-011 — Copy mobile dependencies on Android/Termux F2FS

**Status:** Accepted — hosted CI verified the standard Android export on 2026-10-23; EAS/native signing and device validation remain required before release.

The mobile pnpm root keeps `nodeLinker: hoisted` for Metro compatibility and sets `packageImportMethod: copy`. Testing on the ARM64 Android/Termux F2FS filesystem showed Node's directory-entry metadata can classify hard-linked regular files as symlinks (`Dirent.isSymbolicLink() === true`) while `lstat` reports regular files and `readlink` fails with `EINVAL`. Metro's file map skips those entries, causing an existing `expo-router/entry.js` to look missing.

A clean install with copied files gives the affected package files a link count of one and regular-file metadata, allowing Metro to discover them. Do not replace this with manual entry-path hacks or remove the import method without repeating the file-metadata probe and Android export test. Copying may consume more install time/storage; the normal Hermes/native build must still be verified on a supported runner because this ARM64 host contains an x86-64 Hermes compiler.

## ADR-012 — Keep local signing secrets and generated files out of Git

**Status:** Accepted — 2026-10-23

Keep app-specific ignores for `android/app/google-services.json`, optional `android/keystore.properties`, local upload keystores, and Android build output. Retain generic ignore rules for common signing/certificate formats (`*.jks`, `*.keystore`, `*.p8`, `*.p12`, `*.key`, `*.mobileprovision`), local `.env*.local`, Metro temporary files, package-manager debug logs, macOS metadata, and patch leftovers.

These rules protect local credentials/generated files; they are not part of local-preview behaviour and do not alter app runtime or build code. EAS-managed remote signing does not require a local `keystore.properties`, but local signing may. If Firebase Android services/push are enabled, `google-services.json` must match `com.scholarhub.app` and must not be committed. `.gitignore` affects untracked files only; verify tracked files and Git history separately. If legitimate source is caught by a broad extension rule, explicitly handle that file rather than removing credential protection wholesale.

## ADR-013 — Use `com.scholarhub.app` for the separate ScholarHub app identity

**Status:** Accepted intent; store registration remains unverified — 2026-10-23

The product intent is a separate ScholarHub app using `com.scholarhub.app`, not an in-place update of the legacy BairePorbo listing. The Android/iOS identifiers are configured accordingly. Before release, verify the intended new listing is registered/available and preserve EAS/Play signing credentials. If an existing listing must instead be updated, stop and review package/update compatibility before building or publishing. Matching Firebase registration/configuration is a separate requirement only when Firebase services/push are in the release scope.

## Change process

For a new durable decision, add:
- Context and problem.
- Decision and alternatives considered.
- Consequences and risks.
- Implementation/migration tasks.
- Date and status.

Superseded decisions remain in this log with their status changed; do not silently rewrite history.

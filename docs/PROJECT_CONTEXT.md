# Project Context

_Last reviewed: 2026-10-23_

## 1. Product purpose

ScholarHub is a scholarship discovery, university research, and personal application-management platform. The near-term job is to adapt the existing application to the client’s undergraduate-abroad journey; the longer-term direction is to make the product useful to a wider, international student audience.

The project must provide more than a static directory. It should connect discovery, eligibility explanation, funding comparison, application preparation, deadline tracking, source verification, and private user workflow.

## 2. Initial use case and wider audience

The first use case is an applicant based in Bangladesh preparing for undergraduate entry in 2027, with interests around computer science, cybersecurity, AI, and technology. Funding and application cost are major decision criteria. The profile and preferences must be editable.

This is a starting persona, not a global constraint. The data model must not hardcode one person's nationality, grades, test plans, subject, or intake as universal product rules. Future users may apply from different countries, use different school qualification systems, target different degree levels, and need different languages or intakes.

## 3. Product principles

1. **Official-source-first:** use official universities, governments, and scholarship providers as the primary evidence for material claims.
2. **Evidence and freshness:** record source URL/type, last-checked time, intake/year, evidence excerpt/section, and verification state.
3. **Research and personal state are separate:** updating a public scholarship fact must never overwrite private notes, personal deadlines, application status, essay drafts, or document versions.
4. **Transparent eligibility:** distinguish eligible, ineligible, and unknown/needs-review. Explain which hard criteria produced the result.
5. **Honest funding:** track tuition, stipend/living allowance, accommodation, insurance, travel, application fee, visa/translation costs, conditions, and unknown components separately.
6. **Useful offline behaviour:** saved catalog records and personal workflows should remain usable without a connection; queued changes must be visible and recoverable.
7. **Privacy by default:** private documents stay local by default. Cloud uploads require an intentional, explained user action.
8. **Portability:** users can export their own structured data and understand how to back it up or delete it.
9. **Progressive delivery:** keep a working application at each phase; avoid premature microservices, indiscriminate crawling, or AI automation without review controls.

## 4. Main user journeys

### Discovery
Search across countries, universities, programmes, degree levels, subject areas, intake cycles, funding components, nationality eligibility, academic criteria, test requirements, fees, and deadlines. Save searches, shortlist records, compare opportunities, and open the official application source.

### Eligibility and funding review
Show rule-level results and reasons. Unknown data must be visible instead of silently treated as a match. Display confirmed, excluded, estimated, and unknown funding components separately.

### Application preparation
Turn a saved opportunity into a personal application. Track statuses such as Researching, Eligibility Check, Shortlisted, Preparing Documents, Ready to Submit, Submitted, Interview/Additional Request, and Decision Received; also support Not Eligible, Withdrawn, Deferred, and Waitlisted when relevant. Tasks, notes, and documents belong to a specific user's workflow.

### Source review
Search for opportunities, import a public URL or copied text, extract a draft, inspect the evidence behind important fields, and approve or reject proposed updates. A failed fetch is not proof that an award closed.

### Offline and sync
Browse previously saved opportunities, search locally, edit application status and notes, use tasks/checklists, and export data offline. When online again, users can trigger sync and resolve conflicts without silently losing data.

## 5. Client-provided source materials

A scholarship archive and master workbook were supplied in the conversation. The prior file review indicates that the archive includes structured scholarship folders and private applicant materials such as academic certificates/transcripts, master essays/SOP/CV/story-bank resources, personal documents, and recommendation-letter material. The workbook has five sheets and serves as a working database/template; it must not be treated as a verified, complete scholarship catalogue merely because rows or tabs exist.

Reported source categories include:
- Government Scholarships
- Non-Government Scholarships
- University-Specific Scholarships
- Universities Without Confirmed Funding
- Application Tracker & Documents

Treat these as source-folder categories, not necessarily the final app taxonomy. The actual archive must be available in the working environment before a scripted import is run. Its path is not assumed to exist in this repository.

### Import rules
1. Keep the original archive unchanged and perform work on a separate copy.
2. Inspect folder names, README guidance, workbook sheet names/headers, row counts, links, and source documents before defining mappings.
3. Create a data dictionary and versioned import schema first.
4. Import public scholarship facts and private applicant material through separate pipelines.
5. Preserve provenance and distinguish source-verified facts, imported text, AI-extracted candidates, and personal notes.
6. Report duplicate records, missing URLs, invalid dates, conflicting values, parse errors, and skipped files.
7. Require review for material fields such as eligibility, funding, deadline, and official application URLs.
8. Do not commit the ZIP, workbook with personal details, raw private documents, or extracts containing personal information.

## 6. Planned feature boundaries

### Core product
- Public scholarship/university/programme catalogue and detail pages.
- Search, filters, saved searches, shortlist, and side-by-side comparison.
- Editable applicant profile and explainable matching.
- Funding and cost breakdown.
- Application tracker, tasks, calendar, reminders, document metadata/versioning, essay library.
- Source evidence, freshness, verification, and change-review queue.
- Local/offline data operations, manual sync, backup and restore.

### Advanced extensions
- Cross-device account sync and conflict resolution.
- Assisted URL extraction and compliant scheduled rechecks.
- Public correction suggestions and moderation.
- Better notifications, document vault, encrypted storage options, and more languages.
- University/programme and research-supervisor discovery, only after the scholarship core is stable and data governance is defined.

## 7. Proposed delivery roadmap

The current suggested delivery sequence is recorded in [Production Roadmap (Draft)](PRODUCTION_ROADMAP.md). It is a temporary, editable plan for shipping both the web client and the mobile app against the shared backend. Tasks may be added, removed, split, combined, reordered, or deferred after review; this document does not assert that the proposed features are already implemented or that every item must ship in the first release.

## 8. Non-goals and guardrails

- No promise that every scholarship worldwide is covered.
- No claim that AI estimates predict admission outcomes.
- No auto-publication of unreviewed AI-extracted facts.
- No automated application submission or mass outreach by default.
- No crawler that bypasses login, anti-bot controls, or source access restrictions.
- No uploading client documents to third-party AI/cloud services without explicit, informed consent.

/**
 * Backend response/request shapes for the ScholarHub Next.js API
 * (apps/web/src/app/api/*). Kept in sync manually against the route handlers;
 * imported by both apps/web and apps/mobile so a shape change surfaces at
 * compile time on both clients.
 */

// ── Scholarships ────────────────────────────────────────────────────────────

/** Row shape returned by `GET /api/scholarships` (list projection). */
export interface ScholarshipListItem {
  id: string;
  title: string;
  country: string | null;
  funding_type: string | null;
  deadline: string | null;
  degree_level: string | null;
  tags: string[] | null;
  thumbnail_url: string | null;
  competitiveness: string | null;
  is_flagship: boolean;
  updated_at: string;
  slug: string | null;
  is_live: boolean | null;
  opening_note: string | null;
}

export interface ScholarshipsResponse {
  scholarships: ScholarshipListItem[];
}

/** Full detail returned by `GET /api/scholarships/[id]` (SELECT *). */
export interface ScholarshipDetail extends ScholarshipListItem {
  official_url: string | null;
  raw_description: string | null;
  ai_summary: string | null;
  eligibility_summary: string | null;
  competitiveness: string | null;
  tips: string | null;
  required_documents: RequiredDocuments | null;
  [key: string]: unknown;
}

export interface ScholarshipDetailResponse {
  scholarship: ScholarshipDetail;
}

/** AI-generated (server-cached) document checklist for one scholarship. */
export interface RequiredDocuments {
  core: string[];
  additional: string[];
  note: string;
}

export interface ScholarshipDocumentsResponse {
  documents: RequiredDocuments;
  cached?: boolean;
}

// ── Profile ─────────────────────────────────────────────────────────────────

/** Row shape from the `profiles` table (`GET /api/profile`). `id` === Clerk userId. */
export interface Profile {
  id: string;
  role: string | null;
  full_name: string | null;
  cgpa: number | null;
  work_experience: string | null;
  target_degree: string | null;
  preferred_countries: string | null;
  goals_notes: string | null;
  bsc_major: string | null;
  university: string | null;
  graduation_year: number | null;
  research_interests: string | null;
  published_papers: string | null;
  ielts_score: string | null;
  gre_gmat_score: string | null;
  internships: string | null;
  portfolio_url: string | null;
  // ── Roadmap inputs (Migration 026). Nullable on every existing row. ──
  target_country: string | null;
  target_intake_term: string | null;
  target_intake_year: number | null;
  english_test_type: string | null;
  english_test_status: string | null;
  english_test_date: string | null;
  /** Allow-listed document statuses, merged at the key level server-side. */
  docs: Record<string, string | number> | null;
  /** Set once the roadmap wizard has been completed. */
  roadmap_onboarded_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProfileResponse {
  profile: Profile;
}

/**
 * Fields accepted by `PUT /api/profile`. All optional, and the route writes
 * **only** the keys present in the body — so a client that knows nothing about
 * the roadmap columns cannot clear them by omission.
 */
export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | "full_name"
    | "cgpa"
    | "work_experience"
    | "target_degree"
    | "preferred_countries"
    | "goals_notes"
    | "bsc_major"
    | "university"
    | "graduation_year"
    | "research_interests"
    | "published_papers"
    | "ielts_score"
    | "gre_gmat_score"
    | "internships"
    | "portfolio_url"
  >
> & {
  // ── Roadmap inputs (Migration 026). All nullable; `null` clears. ──
  target_country?: string | null;
  target_intake_term?: string | null;
  target_intake_year?: number | null;
  english_test_type?: string | null;
  english_test_status?: string | null;
  english_test_date?: string | null;
  /** Merged at the key level server-side; an explicit `null` per key removes it. */
  docs?: Record<string, string | number | null> | null;
  /** `true` stamps the server clock; a string is stored as given. */
  roadmap_onboarded_at?: string | boolean | null;
};

// ── Roadmap (auth) ───────────────────────────────────────────────────────────

/**
 * Wire shapes for `/api/roadmap*`. Hand-written snake_case, matching what the
 * routes emit: the engine's own types stay inside apps/web, and one `toWire()`
 * mapper in `GET /api/roadmap` is the only place the two vocabularies meet.
 */
export type Bilingual = { en: string; bn: string };
export type RoadmapFeasibility = "on-track" | "tight" | "not-feasible";
export type RoadmapNarrationStatus = "pending" | "ready" | "failed";
export type MilestoneNodeState = "done" | "active" | "locked" | "skipped";
export type MilestoneStatus = "todo" | "in_progress" | "done" | "skipped";

export interface RoadmapPillar {
  pillar: string;
  earned: number;
  available: number;
  /** `false` ⇒ not enough is known to score this pillar; it cannot yield a weakness. */
  known: boolean;
  detail: Bilingual;
}

export interface RoadmapNote {
  key: string;
  pillar: string;
  points_at_stake: number;
  milestone_key: string | null;
  text: Bilingual;
}

export type RoadmapAction =
  | { kind: "cv" }
  | { kind: "discover"; filters: { country?: string; degree?: string } }
  | { kind: "mentor"; seed_key: string }
  | { kind: "guide"; slug: string }
  | { kind: "form"; section: string };

export interface RoadmapMilestone {
  key: string;
  stage: string;
  title: Bilingual;
  description: Bilingual;
  /** Narration when it landed, catalog copy otherwise. Never empty. */
  why: Bilingual;
  eta_days: number;
  due_by: string;
  priority: number;
  status: MilestoneStatus;
  state: MilestoneNodeState;
  source: "auto" | "manual" | "none";
  progress: number | null;
  target_count: number | null;
  evidence_satisfied: boolean;
  evidence_label: Bilingual | null;
  projected_readiness: number | null;
  projected_gain: number;
  action: RoadmapAction;
}

export interface RoadmapResponse {
  engine_version: number;
  /** `null` ⇒ not enough known to say. Different from 0. */
  readiness: number | null;
  previous_readiness: number | null;
  previous_engine_version: number | null;
  confidence: number;
  highest_weight_unknown: string | null;
  score_breakdown: { weighting: string; pillars: RoadmapPillar[] };
  strengths: RoadmapNote[];
  weaknesses: RoadmapNote[];
  milestones: RoadmapMilestone[];
  next_action: {
    key: string;
    readiness: number | null;
    projected_readiness: number | null;
    projected_gain: number;
    evidence_label: Bilingual | null;
  } | null;
  feasibility: RoadmapFeasibility;
  country_source: "rules" | "generic";
  suggested_intake: { term: string; year: number } | null;
  time_to_intake_days: number | null;
  mentor: Bilingual;
  narration_status: RoadmapNarrationStatus;
  onboarded: boolean;
}

/** Response from `PATCH /api/roadmap/milestones/[key]`. */
export interface MilestonePatchResponse {
  readiness: number | null;
  /** 0 when the milestone's evidence requirement is unsatisfied. */
  delta: number;
  evidence_label: Bilingual | null;
  unlocked_keys: string[];
  celebrate: boolean;
}

// ── Chat ────────────────────────────────────────────────────────────────────

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * One file the mentor should see on this turn. Bytes go to GPT-5.6 Luna
 * (vision model) — DeepSeek V4 Flash is text-only and Gemini is not used
 * for attachments because of token cost.
 */
export interface ChatAttachment {
  /** Display name, e.g. `offer-letter.pdf`. */
  name: string;
  mimeType: string;
  /** Raw base64, without a `data:` URL prefix. */
  data: string;
}

/** Images the vision model accepts inline. `image/jpg` is normalized to jpeg.
 *  Keep in sync with `apps/web/src/lib/chat-attachments.ts`. */
export const CHAT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export const CHAT_FILE_MIME_TYPES = ["application/pdf"] as const;

export const CHAT_ATTACHMENT_MAX_COUNT = 1;
/** Per-file cap. Tight enough to bound vision tokens; 1 MB fits a photo or a typical PDF. */
export const CHAT_ATTACHMENT_MAX_BYTES = 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_TOTAL_BYTES = 1024 * 1024;
/** Signed-in students. Enforced server-side; keep client copy in sync. */
export const CHAT_ATTACHMENT_DAILY_LIMIT = 2;

export const DEFAULT_CHAT_ATTACHMENT_PROMPT =
  "Please look at the attached file(s) and tell me what matters for my scholarship applications.";

/**
 * Request body for `POST /api/chat`. `anonKey` travels as the `x-anon-key` header.
 *
 * The server owns the system prompt: it injects the signed-in student's profile
 * summary and the retrieved scholarship facts on every turn. Any `system`
 * message sent here is folded in as supplementary page context, not used as-is.
 *
 * `attachments` apply only to the latest user turn. History stays text so a
 * follow-up can use DeepSeek again.
 */
export interface ChatRequestBody {
  messages: ChatMessage[];
  sessionId?: string | null;
  /** The single new user turn, persisted server-side when a session is attached. */
  userMessage?: string;
  /**
   * Scholarship the student is currently viewing. The server pins that
   * scholarship's exact deadline and eligibility into the prompt.
   */
  scholarshipId?: string;
  /** Photos / PDFs for this turn. Presence switches the request onto the vision model. */
  attachments?: ChatAttachment[];
}

/** SSE frames emitted by `POST /api/chat` (`data: {...}\n\n`). */
export type ChatStreamFrame =
  | { model: string }
  | { token: string }
  | { error: string };

/** Projection returned by the chat-session endpoints (no user_id/anon_key). */
export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionsResponse {
  sessions: ChatSession[];
}

export interface ChatSessionMessagesResponse {
  messages: (ChatMessage & { id: string; created_at: string })[];
}

// ── Dashboard (auth) ─────────────────────────────────────────────────────────

/** Scholarship projection returned inside the dashboard payload. */
export interface BookmarkScholarship {
  id: string;
  title: string;
  country: string | null;
  funding_type: string | null;
  deadline: string | null;
  thumbnail_url: string | null;
  competitiveness: string | null;
  degree_level: string | null;
}

/** Response from `GET /api/dashboard` — profile readiness, bookmarks, last chat. */
export interface DashboardResponse {
  user: { name: string; email: string | null };
  stats: {
    readiness: number;
    bookmarksCount: number;
    missingFields: string[];
    newScholarshipsCount: number;
  };
  bookmarks: BookmarkScholarship[];
  bookmarksClosingSoon: BookmarkScholarship[];
  lastSession: { id: string; title: string; updated_at: string; preview: string | null } | null;
}

// ── Bookmarks (auth) ─────────────────────────────────────────────────────────

export interface BookmarksResponse {
  bookmarks: { scholarship_id: string }[];
}

// ── Guides (public) ──────────────────────────────────────────────────────────

export interface GuideFaq {
  question: string;
  answer: string;
}

/** Row returned by `GET /api/guides` (published guides). */
export interface Guide {
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  intro: string | null;
  content: string | null;
  faqs: GuideFaq[] | null;
  published_at: string | null;
  updated_at: string | null;
  cover_image_url: string | null;
  is_pinned: boolean;
}

export interface GuidesResponse {
  guides: Guide[];
}

export interface GuideDetailResponse {
  guide: Guide;
}

// ── CV Builder (auth) ────────────────────────────────────────────────────────

export type CVTemplateId = "classic" | "modern" | "europass" | "photo";

export interface ContactLink { label: string; url: string }
export interface EducationEntry {
  institution: string; degree: string; field: string; location: string;
  startDate: string; endDate: string; gpa: string; details: string;
}
export interface ExperienceEntry {
  role: string; organization: string; location: string;
  startDate: string; endDate: string; description: string;
}
export interface AwardEntry { title: string; issuer: string; year: string; description: string }
export interface SkillGroup { category: string; items: string }
export interface ReferenceEntry { name: string; affiliation: string; relation: string; email: string }
export interface PublicationEntry { title: string; venue: string; date: string; doi: string }
export interface ProjectEntry {
  title: string; organization: string; link: string;
  startDate: string; endDate: string; description: string;
}
export interface TextEntry { text: string }

export type SectionKey =
  | "researchInterests" | "summary" | "education" | "researchExperience"
  | "publications" | "teachingExperience" | "workExperience" | "projects"
  | "presentations" | "awards" | "skills" | "languages" | "references";

/** Full CV document (stored as JSONB in `user_cvs.data`). */
export interface CVData {
  fullName: string; headline: string; photo: string; showPhoto: boolean;
  email: string; phone: string; location: string; website: string;
  githubUrl: string; googleScholarUrl: string; orcid: string; kaggleUrl: string;
  links: ContactLink[];
  researchInterests: string; summary: string;
  education: EducationEntry[];
  researchExperience: ExperienceEntry[];
  workExperience: ExperienceEntry[];
  teachingExperience: ExperienceEntry[];
  projects: ProjectEntry[];
  publications: PublicationEntry[];
  presentations: TextEntry[];
  awards: AwardEntry[];
  skills: SkillGroup[];
  languages: TextEntry[];
  references: ReferenceEntry[];
  sectionOrder: SectionKey[];
}

export interface CVRecord {
  id: string;
  title: string;
  template: CVTemplateId;
  data: CVData;
  created_at: string;
  updated_at: string;
}

export interface CvsResponse { cvs: CVRecord[] }
export interface CvResponse { cv: CVRecord }

/** Structured feedback from `POST /api/cv/analyze`. */
export interface SectionFeedback {
  name: string;
  rating: "strong" | "adequate" | "needs-work" | "missing";
  feedback: string;
  suggestions: string[];
}
export interface CVAnalysis {
  overallScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  sections: SectionFeedback[];
  missingSections: string[];
  actionItems: string[];
}
export interface CvAnalyzeResponse {
  analysis: CVAnalysis;
  sourceName: string | null;
}

// ── Meta ────────────────────────────────────────────────────────────────────

export interface MetaResponse {
  chatModelLabel: string;
  chatModelFallbackLabel: string | null;
}

// ── Errors ──────────────────────────────────────────────────────────────────

export type RateLimitScope = "hourly" | "daily" | "global";

/** Non-200 body returned by rate-limited chat requests. */
export interface RateLimitErrorBody {
  error: string;
  scope: RateLimitScope;
  resetMs: number;
  resetIn: string;
  signinRequired?: boolean;
  remaining: { hourly: number; daily: number; global: number };
}

/** Generic `{ error }` body used by most route handlers on failure. */
export interface ApiErrorBody {
  error: string;
  [key: string]: unknown;
}

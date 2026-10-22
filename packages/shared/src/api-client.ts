/**
 * Framework-agnostic API client for the ScholarHub Next.js backend.
 *
 * Centralizes: the API base URL, Clerk Bearer-token injection, the `x-anon-key`
 * header for anonymous chat, and error parsing. Consumed by apps/mobile (and,
 * later, apps/web). No React, no Expo, no Node built-ins — just `fetch`.
 */

import type {
  BookmarksResponse,
  ChatRequestBody,
  ChatSessionMessagesResponse,
  ChatSessionsResponse,
  CVData,
  CVTemplateId,
  CvAnalyzeResponse,
  CvResponse,
  CvsResponse,
  DashboardResponse,
  GuideDetailResponse,
  GuidesResponse,
  MetaResponse,
  MilestonePatchResponse,
  MilestoneStatus,
  ProfileResponse,
  ProfileUpdate,
  RoadmapResponse,
  ScholarshipDetailResponse,
  ScholarshipDocumentsResponse,
  ScholarshipsResponse,
} from "./types";

/** Error thrown for any non-2xx response, carrying the parsed JSON body. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown> | null;

  constructor(status: number, body: Record<string, unknown> | null, message?: string) {
    super(message ?? (typeof body?.error === "string" ? body.error : `Request failed (${status})`));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** True when the backend signals that the anonymous trial cap was hit. */
  get signinRequired(): boolean {
    return this.body?.signinRequired === true;
  }
}

export type GetTokenOpts = { skipCache?: boolean };

export interface ApiClientConfig {
  /** e.g. https://baireporbo.app */
  baseUrl: string;
  /**
   * Returns a Clerk session token, or null when signed out.
   * Pass `{ skipCache: true }` after a 401 so the caller can mint a new JWT
   * instead of replaying the expired one that just failed.
   */
  getToken: (opts?: GetTokenOpts) => Promise<string | null>;
  /** Stable per-install key for anonymous chat rate limiting (optional). */
  getAnonKey?: () => string | null | Promise<string | null>;
  /** Injectable fetch (RN passes `expo/fetch` for streaming). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

type RequestOpts = {
  /** Public endpoints that 403 if an Authorization header is present. */
  skipAuth?: boolean;
  /** Auth-only endpoints: never hit the network without a Bearer token. */
  requiredAuth?: boolean;
};

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, getToken, getAnonKey } = config;
  const doFetch = config.fetchImpl ?? fetch;

  async function resolveAnonKey(): Promise<string | null> {
    if (!getAnonKey) return null;
    return (await getAnonKey()) ?? null;
  }

  async function buildHeaders(
    extra: Record<string, string> | undefined,
    opts: RequestOpts & { token?: string },
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = { ...extra };
    if (opts.skipAuth) return headers;

    let token = opts.token ?? (await getToken());
    // An auth-only endpoint is worth one forced mint before giving up: the
    // cached JWT may have expired while the session itself is still valid.
    if (!token && opts.requiredAuth) {
      token = await getToken({ skipCache: true });
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
      return headers;
    }

    if (opts.requiredAuth) {
      throw new ApiError(401, { error: "Unauthorized" }, "Not signed in");
    }

    // Anonymous callers identify themselves to the session/chat endpoints via
    // the x-anon-key header. Harmless on endpoints that ignore it.
    const anonKey = await resolveAnonKey();
    if (anonKey) headers["x-anon-key"] = anonKey;
    return headers;
  }

  async function parseErrorBody(res: Response): Promise<Record<string, unknown> | null> {
    try {
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * One network attempt, plus a single skip-cache retry on 401. That covers the
   * Android-resume case where Clerk's cached JWT has expired (typically 60s)
   * but the long-lived session is still valid — without a retry the Home tab
   * would keep polling /api/dashboard + /api/roadmap unauthenticated.
   */
  async function authorizedFetch(
    path: string,
    init: RequestInit = {},
    opts: RequestOpts = {},
  ): Promise<Response> {
    const extra = init.headers as Record<string, string> | undefined;
    const send = (token?: string) =>
      buildHeaders(extra, { ...opts, token }).then((headers) =>
        doFetch(`${baseUrl}${path}`, { ...init, headers }),
      );

    let res = await send();
    if (res.status === 401 && !opts.skipAuth) {
      const fresh = await getToken({ skipCache: true });
      if (fresh) res = await send(fresh);
    }
    return res;
  }

  async function request<T>(
    path: string,
    init: RequestInit = {},
    opts: RequestOpts = {},
  ): Promise<T> {
    const res = await authorizedFetch(path, init, opts);

    if (!res.ok) {
      throw new ApiError(res.status, await parseErrorBody(res));
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async function jsonRequest<T>(
    path: string,
    method: string,
    body?: unknown,
    opts: RequestOpts = {},
  ): Promise<T> {
    return request<T>(
      path,
      {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      opts,
    );
  }

  const authed: RequestOpts = { requiredAuth: true };

  return {
    ApiError,

    // ── Scholarships (public) ──
    getScholarships(status = "published") {
      return request<ScholarshipsResponse>(`/api/scholarships?status=${encodeURIComponent(status)}`);
    },
    getScholarship(id: string) {
      return request<ScholarshipDetailResponse>(`/api/scholarships/${encodeURIComponent(id)}`);
    },
    /** POST-driven: generates (once) then returns the cached document checklist. */
    getScholarshipDocuments(id: string) {
      return jsonRequest<ScholarshipDocumentsResponse>(
        `/api/scholarships/${encodeURIComponent(id)}/documents`,
        "POST",
        {},
      );
    },

    // ── Guides (public) — must be fetched anonymously; the endpoint 403s on auth. ──
    getGuides() {
      return request<GuidesResponse>(`/api/guides`, {}, { skipAuth: true });
    },
    /** Fetched by slug so a just-published guide (e.g. opened from its push
     * notification) is reachable before the cached /api/guides list catches up. */
    getGuide(slug: string) {
      return request<GuideDetailResponse>(`/api/guides/${encodeURIComponent(slug)}`, {}, { skipAuth: true });
    },

    // ── Meta (public) ──
    getMeta() {
      return request<MetaResponse>(`/api/meta`);
    },

    // ── Dashboard (auth) — profile readiness, bookmarks, last chat ──
    getDashboard() {
      return request<DashboardResponse>(`/api/dashboard`, {}, authed);
    },

    // ── CV Builder (auth) ──
    getCvs() {
      return request<CvsResponse>(`/api/cv`, {}, authed);
    },
    getCv(id: string) {
      return request<CvResponse>(`/api/cv/${encodeURIComponent(id)}`, {}, authed);
    },
    createCv(body: { title?: string; template?: CVTemplateId; data?: Partial<CVData> } = {}) {
      return jsonRequest<CvResponse>(`/api/cv`, "POST", body, authed);
    },
    updateCv(id: string, body: { title: string; template: CVTemplateId; data: CVData }) {
      return jsonRequest<CvResponse>(`/api/cv/${encodeURIComponent(id)}`, "PUT", body, authed);
    },
    deleteCv(id: string) {
      return request<{ ok: boolean }>(`/api/cv/${encodeURIComponent(id)}`, { method: "DELETE" }, authed);
    },
    /** Analyse pasted CV text. */
    analyzeCvText(text: string) {
      return jsonRequest<CvAnalyzeResponse>(`/api/cv/analyze`, "POST", { text }, authed);
    },
    /** Analyse an uploaded file. Pass a FormData with a `file` field (RN: {uri,name,type}). */
    async analyzeCvFile(form: FormData) {
      // No Content-Type: fetch sets the multipart boundary itself.
      const res = await authorizedFetch("/api/cv/analyze", { method: "POST", body: form }, authed);
      if (!res.ok) {
        throw new ApiError(res.status, await parseErrorBody(res));
      }
      return (await res.json()) as CvAnalyzeResponse;
    },

    // ── Bookmarks (auth) ──
    getBookmarks() {
      return request<BookmarksResponse>(`/api/bookmarks`, {}, authed);
    },
    addBookmark(scholarshipId: string) {
      return jsonRequest<{ success: boolean; already?: boolean }>(
        `/api/bookmarks`,
        "POST",
        { scholarship_id: scholarshipId },
        authed,
      );
    },
    removeBookmark(scholarshipId: string) {
      return request<{ success: boolean }>(
        `/api/bookmarks`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scholarship_id: scholarshipId }),
        },
        authed,
      );
    },

    // ── Push tokens (auth) — device registry for FCM fan-out ──
    /** Called on every launch: FCM rotates tokens and we only learn by re-sending. */
    registerPushToken(body: {
      token: string;
      platform: string;
      lang: string;
      appVersion?: string;
    }) {
      return jsonRequest<{ ok: boolean }>(`/api/push/register`, "POST", body, authed);
    },
    unregisterPushToken(body: { token: string }) {
      return jsonRequest<{ ok: boolean }>(`/api/push/register`, "DELETE", body, authed);
    },

    // ── Profile (auth) — the Bearer-token canary (§3.4) ──
    getProfile() {
      return request<ProfileResponse>(`/api/profile`, {}, authed);
    },
    updateProfile(update: ProfileUpdate) {
      return jsonRequest<ProfileResponse>(`/api/profile`, "PUT", update, authed);
    },

    // ── Roadmap (auth) ──
    /** The deterministic roadmap. Always complete, whether or not the AI ran. */
    getRoadmap() {
      return request<RoadmapResponse>(`/api/roadmap`, {}, authed);
    },
    /** Asks for fresh narration. Returns 200 with `narration_status: 'failed'`
     *  rather than an error when the model is unreachable. */
    generateRoadmap() {
      return jsonRequest<RoadmapResponse>(`/api/roadmap/generate`, "POST", {}, authed);
    },
    /** A status write. Never moves the readiness score. */
    updateMilestone(key: string, body: { status?: MilestoneStatus; progress?: number }) {
      return jsonRequest<MilestonePatchResponse>(
        `/api/roadmap/milestones/${encodeURIComponent(key)}`,
        "PATCH",
        body,
        authed,
      );
    },

    // ── Chat sessions (auth or anon) ──
    getChatSessions() {
      return request<ChatSessionsResponse>(`/api/chat/sessions`);
    },
    async createChatSession(title?: string) {
      // Anon callers must pass anonKey in the body; ignored server-side when signed in.
      const anonKey = await resolveAnonKey();
      return jsonRequest<{ session: ChatSessionsResponse["sessions"][number] }>(
        `/api/chat/sessions`,
        "POST",
        { anonKey, title },
      );
    },
    getChatMessages(sessionId: string) {
      return request<ChatSessionMessagesResponse>(
        `/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
      );
    },
    deleteChatSession(sessionId: string) {
      return request<void>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
    },

    /**
     * Stream a chat completion from `POST /api/chat`.
     *
     * Reads the SSE body, splits on newlines, and forwards each parsed
     * `data: {...}` frame — `{ model }` first, then `{ token }` deltas, ending
     * on `[DONE]`. RN callers MUST pass `expo/fetch` as `fetchImpl` (the default
     * RN fetch cannot read a streaming body). Throws `ApiError` on a non-200.
     */
    async streamChat(
      body: ChatRequestBody,
      opts: {
        onModel?: (model: string) => void;
        onToken: (token: string) => void;
        signal?: AbortSignal;
      },
    ): Promise<void> {
      const res = await authorizedFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: opts.signal,
      });

      if (!res.ok) {
        let errBody: Record<string, unknown> | null = null;
        try {
          errBody = (await res.json()) as Record<string, unknown>;
        } catch {
          /* ignore */
        }
        throw new ApiError(res.status, errBody);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Streaming not supported by this fetch implementation.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;

          try {
            const frame = JSON.parse(payload) as { model?: string; token?: string; error?: string };
            if (frame.error) throw new ApiError(res.status, { error: frame.error });
            if (typeof frame.model === "string") opts.onModel?.(frame.model);
            if (typeof frame.token === "string") opts.onToken(frame.token);
          } catch (err) {
            if (err instanceof ApiError) throw err;
            /* skip unparseable frame */
          }
        }
      }
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

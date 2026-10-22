"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/lib/auth";
import { useT, useLang } from "@/lib/lang-context";
import { useDialog } from "@/components/ui/dialog-provider";
import PrimaryNav from "@/components/layout/primary-nav";
import { homeHref } from "@/lib/i18n";
import styles from "./chat.module.css";

// ── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

type ChatMessage = {
  role: Role;
  content: string;
  time: string;
};

type Session = {
  id: string;
  title: string;
  updated_at: string;
};

// ── Constants ────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Show scholarships closing in 60 days",
  "Do I need IELTS for Germany?",
  "Summarize DAAD EPOS requirements",
  "Create a 90-day prep plan",
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Stable anonymous key persisted in localStorage */
function getOrCreateAnonKey(): string {
  const stored = localStorage.getItem("bp_anon_key");
  if (stored) return stored;
  const key =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
          const randomValue =
            typeof crypto?.getRandomValues === "function"
              ? crypto.getRandomValues(new Uint8Array(1))[0]
              : Math.floor(Math.random() * 256);
          const value = char === "x" ? randomValue : (randomValue % 16) + 8;
          return value.toString(16);
        });
  localStorage.setItem("bp_anon_key", key);
  return key;
}

const ANON_DAILY_LIMIT = 3;

/** UTC date string used for daily counter rollover. */
function todayKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Read the anonymous user's message count for the current UTC day. */
function readAnonUsage(): number {
  try {
    const raw = localStorage.getItem("bp_anon_usage");
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { day: string; count: number };
    if (parsed.day !== todayKey()) return 0;
    return parsed.count;
  } catch {
    return 0;
  }
}

function bumpAnonUsage(): number {
  const current = readAnonUsage();
  const next = current + 1;
  try {
    localStorage.setItem(
      "bp_anon_usage",
      JSON.stringify({ day: todayKey(), count: next }),
    );
  } catch {
    // ignore quota / private mode failures
  }
  return next;
}

const WELCOME_USER: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm your ScholarHub Mentor. I can help you find scholarships, check eligibility, and build an application strategy.\n\nType your question below and press **Enter** to send. What program are you aiming for?",
  time: formatTime(new Date()),
};

const WELCOME_ANON: ChatMessage = {
  role: "assistant",
  content:
    `Hi! I'm your ScholarHub Mentor. You have **${ANON_DAILY_LIMIT} free messages** today — no signup needed.\n\nAsk me anything about scholarships, eligibility, or applications. Type below and press **Enter** to send.`,
  time: formatTime(new Date()),
};

// ── Component ────────────────────────────────────────────────────────────────

function ChatContent() {
  const searchParams = useSearchParams();
  const dialog = useDialog();
  const { userId, signOut } = useAuth();
  const t = useT();
  const { lang } = useLang();

  const [anonKey, setAnonKey] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_USER]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"ready" | "thinking" | "streaming" | "error">("ready");
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    message: string;
    scope: "hourly" | "daily" | "global";
    signinRequired: boolean;
    resetIn: string;
  } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [anonUsage, setAnonUsage] = useState<number>(0);

  const isAnon = !userId;
  const welcomeMessage = useMemo(() => (isAnon ? WELCOME_ANON : WELCOME_USER), [isAnon]);
  const anonRemaining = Math.max(0, ANON_DAILY_LIMIT - anonUsage);

  const chatWindowRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // ── Init: load anon key and sessions ──────────────────────────────────────

  useEffect(() => {
    const key = getOrCreateAnonKey();
    setAnonKey(key);
    setAnonUsage(readAnonUsage());
    if (userId) {
      loadSessions(key);
    }
  }, [userId]);

  // Reset welcome message and clear sessions when auth state changes
  useEffect(() => {
    setMessages([isAnon ? WELCOME_ANON : WELCOME_USER]);
    if (isAnon) {
      setSessions([]);
      setActiveSessionId(null);
    }
  }, [isAnon]);

  // Pre-fill from ?question= query param
  useEffect(() => {
    const question = searchParams.get("question");
    if (question) setInput(question);
  }, [searchParams]);

  // Open a specific session via ?session=<id> (used by the dashboard "Resume" link)
  useEffect(() => {
    const sessionIdParam = searchParams.get("session");
    if (!sessionIdParam || !userId) return;
    // Build a minimal Session shape — loadSessionHistory only needs id.
    loadSessionHistory({
      id: sessionIdParam,
      title: "",
      updated_at: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, userId]);

  // Auto-scroll to bottom
  useEffect(() => {
    const el = chatWindowRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  // ── Session management ────────────────────────────────────────────────────

  const loadSessions = async (key: string) => {
    try {
      const res = await fetch("/api/chat/sessions", {
        headers: { "x-anon-key": key },
      });
      if (!res.ok) return;
      const data: { sessions: Session[] } = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      // non-critical — sidebar just shows empty
    }
  };

  const createSession = useCallback(
    async (firstMessage: string): Promise<string | null> => {
      if (!anonKey) return null;
      try {
        const res = await fetch("/api/chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anonKey, title: firstMessage.slice(0, 60) }),
        });
        if (!res.ok) return null;
        const data: { session: Session } = await res.json();
        const session = data.session;
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        return session.id;
      } catch {
        return null;
      }
    },
    [anonKey]
  );

  const loadSessionHistory = async (session: Session) => {
    setActiveSessionId(session.id);
    setError(null);
    try {
      const res = await fetch(`/api/chat/sessions/${session.id}/messages`, {
        headers: anonKey ? { "x-anon-key": anonKey } : undefined,
      });
      if (!res.ok) return;
      const data: {
        messages: { role: string; content: string; created_at: string }[];
      } = await res.json();

      const loaded: ChatMessage[] = data.messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
        time: formatTime(new Date(m.created_at)),
      }));
      setMessages(loaded.length > 0 ? loaded : [welcomeMessage]);
    } catch {
      setMessages([welcomeMessage]);
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([welcomeMessage]);
    setInput("");
    setError(null);
    setRateLimitInfo(null);
    setStatus("ready");
    if (anonKey && !isAnon) loadSessions(anonKey);
  };

  const deleteSession = async (sessionId: string) => {
    const confirmed = await dialog.confirm({
      title: t("chat.deleteTitle"),
      description: t("chat.deleteDesc"),
      isDestructive: true,
      confirmText: t("chat.delete"),
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "DELETE",
        headers: anonKey ? { "x-anon-key": anonKey } : undefined,
      });
      if (!res.ok) return;

      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([welcomeMessage]);
        setInput("");
        setError(null);
      }
    } catch {
      // non-critical
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
      time: formatTime(new Date()),
    };

    const history = [...messages, userMessage].map(({ role, content }) => ({
      role: role === "user" ? "user" : "assistant",
      content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStatus("thinking");
    setError(null);
    setRateLimitInfo(null);
    if (isAnon) {
      setAnonUsage(bumpAnonUsage());
    }

    // Ensure we have a session in DB (only for signed-in users; anon
    // chats stay client-side so we don't clutter the DB and so the user
    // doesn't lose anything when they sign up).
    let sessionId = activeSessionId;
    if (!sessionId && !isAnon) {
      sessionId = await createSession(trimmed);
    }

    // Empty assistant bubble — tokens stream into it
    const placeholder: ChatMessage = {
      role: "assistant",
      content: "",
      time: formatTime(new Date()),
    };
    setMessages((prev) => [...prev, placeholder]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          sessionId,
          userMessage: trimmed,
        }),
      });

      if (!res.ok || !res.body) {
        if (res.status === 429) {
          const data: {
            error?: string;
            scope?: "hourly" | "daily" | "global";
            signinRequired?: boolean;
            resetIn?: string;
          } = await res.json().catch(() => ({}));
          setRateLimitInfo({
            message: data.error ?? "Rate limit reached. Please retry shortly.",
            scope: data.scope ?? "hourly",
            signinRequired: !!data.signinRequired,
            resetIn: data.resetIn ?? "shortly",
          });
          setStatus("error");
          // Roll back the placeholder + the user bubble we just added,
          // so the user can edit/retry without ghost messages.
          setMessages((prev) => {
            const updated = [...prev];
            // remove placeholder if empty
            if (updated[updated.length - 1]?.content === "") updated.pop();
            // remove the user message we just appended
            if (updated[updated.length - 1]?.role === "user") updated.pop();
            return updated;
          });
          setInput(trimmed);
          return;
        }
        const data: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
          if (!trimmedLine.startsWith("data:")) continue;

          const jsonStr = trimmedLine.slice(5).trim();
          let parsed: { token?: string; error?: string; model?: string };
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (parsed.error) throw new Error(parsed.error);

          if (parsed.token) {
            setStatus("streaming");
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + parsed.token,
                };
              }
              return updated;
            });
          }
        }
      }

      // Refresh session list so title/timestamp update
      if (anonKey && !isAnon) loadSessions(anonKey);
    } catch (err) {
      setError(String(err));
      setStatus("error");
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.content === "") updated.pop();
        return updated;
      });
    } finally {
      setIsLoading(false);
      setStatus((prev) => (prev === "error" ? "error" : "ready"));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
    // Reset textarea height after send
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
      // Reset textarea height after send
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
      <div className={styles.page} data-fullscreen="true">
        {isSidebarOpen && (
          <div 
            className={styles.sidebarBackdrop} 
            onClick={() => setIsSidebarOpen(false)} 
            aria-hidden="true"
          />
        )}
        {/* ── Sidebar ── */}
        <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarBrandRow}>
              <Link href={homeHref(lang)} className={styles.brand} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Image src="/logo.png" alt="ScholarHub Logo" width={30} height={30} className={styles.brandLogo} />
                <div>
                  <p className={styles.brandName}>ScholarHub</p>
                  <span className={styles.brandTag}>AI Mentor</span>
                </div>
              </Link>
              <button
                className={styles.mobileSidebarToggle}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                type="button"
              >
                {isSidebarOpen ? t("nav.close") : t("nav.menu")}
              </button>
            </div>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => {
                startNewChat();
                setIsSidebarOpen(false);
              }}
            >
              {t("chat.newChat")}
            </button>
          </div>

          <div className={`${styles.sidebarContent} ${isSidebarOpen ? styles.sidebarContentOpen : ""}`}>
            <div className={styles.sidebarNav}>
              {/* On mobile the bottom tab bar handles primary nav, so hide
                  these links — keeps the chat history panel focused. */}
              <div className={styles.sidebarNavLinks}>
                <PrimaryNav className={styles.navVertical} />
              </div>
              {userId ? (
                <button className={styles.ghostButton} type="button" onClick={signOut}>
                  {t("chat.signOut")}
                </button>
              ) : (
                <Link
                  href="/auth/signup"
                  className={styles.primaryButton}
                  style={{ display: "block", textAlign: "center" }}
                >
                  {t("chat.signUpFree")}
                </Link>
              )}
            </div>

            {!isAnon && (
              <div className={styles.sessionList}>
                {sessions.length === 0 && (
                  <p className={styles.sessionEmpty}>{t("chat.noPastConversations")}</p>
                )}
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`${styles.sessionCard} ${
                      activeSessionId === session.id ? styles.sessionCardActive : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      loadSessionHistory(session);
                      setIsSidebarOpen(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        loadSessionHistory(session);
                        setIsSidebarOpen(false);
                      }
                    }}
                  >
                    <div className={styles.sessionTop}>
                      <span className={styles.sessionTitle}>{session.title}</span>
                      <div className={styles.sessionMeta}>
                        <span className={styles.sessionTime}>
                          {formatRelative(session.updated_at)}
                        </span>
                        <button
                          className={styles.sessionDelete}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteSession(session.id);
                          }}
                          aria-label={t("chat.delete")}
                        >
                          {t("chat.delete")}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isAnon && (
              <div className={styles.anonSidebar}>
                <p className={styles.anonSidebarTitle}>{t("chat.freePreview")}</p>
                <p className={styles.anonSidebarBody}>
                  {t("chat.tryingWithout")}{" "}
                  <strong>{anonRemaining} of {ANON_DAILY_LIMIT}</strong> {t("chat.freeMessagesLeftPost")}
                </p>
                <p className={styles.anonSidebarBody} style={{ marginTop: 8 }}>
                  {t("chat.signUpForMore")}
                </p>
              </div>
            )}

            <div className={styles.sidebarFooter}>
              <span>{t("chat.poweredBy")} ScholarHub AI</span>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className={styles.main}>
          <header className={styles.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                className={styles.mobileSidebarToggleMain} 
                onClick={() => setIsSidebarOpen(true)}
                aria-label={t("chat.openMenu")}
                type="button"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              <h1>
                <span className={styles.titleFull}>{t("chat.title")}</span>
                <span className={styles.titleShort} aria-hidden="true">{t("chat.titleShort")}</span>
              </h1>
            </div>
          </header>

          <section className={styles.contextBar}>
            <div className={styles.contextItem}>
              <span className={styles.contextLabelInline}>{t("chat.aiModel")}</span>
              <span className={styles.contextValue}>ScholarHub AI</span>
            </div>
            <div className={styles.contextItem}>
              <span className={styles.contextLabelInline}>{t("chat.status")}</span>
              <span
                className={
                  status === "thinking"
                    ? styles.statusLoading
                    : status === "streaming"
                      ? styles.statusStreaming
                      : status === "error"
                        ? styles.statusError
                        : styles.statusReady
                }
                aria-live="polite"
              >
                <span className={styles.statusDot} aria-hidden="true" />
                {status === "thinking"
                  ? t("chat.thinking")
                  : status === "streaming"
                    ? t("chat.streaming")
                    : status === "error"
                      ? t("chat.error")
                      : t("chat.ready")}
              </span>
            </div>
          </section>

          <section className={styles.chatWindow} ref={chatWindowRef}>
            {messages.map((msg, index) => (
              <div
                key={`${msg.time}-${index}`}
                className={
                  msg.role === "assistant"
                    ? styles.messageAssistant
                    : styles.messageStudent
                }
              >
                <div className={styles.messageBubble}>
                  <div className={styles.markdownBody}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  <span>{msg.time}</span>
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.content === "" && (
              <div className={styles.messageAssistant}>
                <div className={`${styles.messageBubble} ${styles.loadingBubble}`}>
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              </div>
            )}

            {rateLimitInfo && (
              <div className={styles.rateLimitBanner} role="alert">
                <div className={styles.rateLimitIcon} aria-hidden="true">⏳</div>
                <div className={styles.rateLimitBody}>
                  <p className={styles.rateLimitTitle}>{rateLimitInfo.message}</p>
                  {rateLimitInfo.signinRequired ? (
                    <Link href="/auth/login" className={styles.rateLimitCta}>
                      {t("chat.signInToContinue")}
                    </Link>
                  ) : (
                    <p className={styles.rateLimitHint}>
                      {t("chat.tryAgainIn")} {rateLimitInfo.resetIn}.
                    </p>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className={styles.errorBanner}>⚠️ {error}</div>
            )}
          </section>

          {messages.every((m) => m.role !== "user") && (
            <section className={styles.suggestions}>
              <p className={styles.suggestionLabel}>{t("chat.suggestedPrompts")}</p>
              <div className={styles.suggestionGrid}>
                {SUGGESTIONS.map((prompt) => (
                  <button
                    key={prompt}
                    className={styles.suggestionChip}
                    onClick={() => sendMessage(prompt)}
                    type="button"
                    disabled={isLoading}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>
          )}

          <form className={styles.inputBar} onSubmit={handleSubmit}>
            <label className={styles.inputLabel}>
              <span className={styles.inputLabelText}>{t("chat.askMentor")}</span>
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder={t("chat.askAnything")}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(); }}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
            </label>
            <div className={styles.inputActions}>
              {isAnon && anonRemaining > 0 && (
                <span
                  className={`${styles.anonQuotaChip} ${
                    anonRemaining <= 1 ? styles.anonQuotaChipLow : ""
                  }`}
                  aria-live="polite"
                >
                  {anonRemaining} {t("chat.freeMessagesLeftPost")}{" "}
                  <Link href="/auth/signup">{t("tab.signUp")}</Link>
                </span>
              )}
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? t("chat.sending") : t("chat.send")}
              </button>
            </div>
          </form>

          <p className={styles.aiDisclaimer}>
            {t("chat.disclaimer")}
          </p>
        </main>
      </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}

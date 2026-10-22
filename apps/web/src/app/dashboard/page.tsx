"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import AuthGuard from "@/components/auth/auth-guard";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/lang-context";
import AppNavbar from "@/components/layout/app-navbar";
import styles from "./dashboard.module.css";

type Scholarship = {
  id: string;
  title: string;
  country: string;
  deadline: string | null;
  funding_type: string;
  competitiveness: string | null;
  thumbnail_url: string | null;
  degree_level: string | null;
};

type DashboardData = {
  user: { name: string; email: string };
  stats: {
    readiness: number;
    bookmarksCount: number;
    missingFields: string[];
    newScholarshipsCount: number;
  };
  bookmarks: Scholarship[];
  bookmarksClosingSoon: Scholarship[];
  lastSession: {
    id: string;
    title: string;
    updated_at: string;
    preview: string | null;
  } | null;
};

// Small inline icon set, shared between the hero stat chips and panel
// headers so the same glyph always means the same thing across the page
// (readiness → user, saved → bookmark, closing soon → clock).
function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5 13.6 8.4 18.5 10 13.6 11.6 12 16.5 10.4 11.6 5.5 10l4.9-1.6L12 3.5Z" fill="currentColor" />
      <path
        d="M18 15.5 18.7 17.3 20.5 18 18.7 18.7 18 20.5 17.3 18.7 15.5 18 17.3 17.3 18 15.5Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4.2l2.6 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 19.5c1.2-3.4 4-5 7-5s5.8 1.6 7 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6a2.5 2.5 0 0 1-2.5 2.5H9l-3.6 3v-3H6.5A2.5 2.5 0 0 1 4 12.5v-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 4A1.5 1.5 0 0 0 5 5.5v14l7-4.5 7 4.5v-14A1.5 1.5 0 0 0 17.5 4h-11Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const MATCH_CACHE_KEY = "bp_dashboard_matches";
const MATCH_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

const greetingKeyFor = (date = new Date()) => {
  const h = date.getHours();
  if (h < 5) return "dashboard.greetingHello" as const;
  if (h < 12) return "dashboard.greetingMorning" as const;
  if (h < 17) return "dashboard.greetingAfternoon" as const;
  return "dashboard.greetingEvening" as const;
};

const daysRemaining = (deadline: string | null): number | null => {
  if (!deadline) return null;
  const t = new Date(deadline).getTime();
  if (isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
};

const formatDeadlineShort = (deadline: string | null) => {
  if (!deadline) return "Open";
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const relative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function DashboardPage() {
  const { signOut } = useAuth();
  const t = useT();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const [matches, setMatches] = useState<Scholarship[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Mobile-only segmented tab — desktop ignores this.
  type MobileTab = "today" | "bookmarks" | "profile";
  const [mobileTab, setMobileTab] = useState<MobileTab>("today");

  // ── Load dashboard data ──
  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((json: DashboardData | { error: string }) => {
        if ("error" in json) {
          setLoading(false);
          return;
        }
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Auto-run AI Match (cached for 1h client-side) ──
  useEffect(() => {
    if (!data) return;
    if (data.stats.readiness < 20) return; // don't bother on near-empty profiles

    // Try local cache first
    try {
      const raw = localStorage.getItem(MATCH_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number; matches: Scholarship[] };
        if (parsed.at && Date.now() - parsed.at < MATCH_CACHE_TTL_MS) {
          setMatches(parsed.matches);
          return;
        }
      }
    } catch {
      // ignore
    }

    let cancelled = false;
    setMatchesLoading(true);
    fetch("/api/profile/match")
      .then(async (res) => {
        const json = (await res.json()) as { matches?: Scholarship[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setMatchError(json.error ?? "Couldn't fetch matches.");
          setMatches([]);
        } else {
          const top = (json.matches ?? []).slice(0, 6);
          setMatches(top);
          try {
            localStorage.setItem(
              MATCH_CACHE_KEY,
              JSON.stringify({ at: Date.now(), matches: top }),
            );
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setMatchError("Couldn't fetch matches.");
      })
      .finally(() => {
        if (!cancelled) setMatchesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data]);

  const refreshMatches = async () => {
    setMatchesLoading(true);
    setMatchError(null);
    try {
      const res = await fetch("/api/profile/match");
      const json = (await res.json()) as { matches?: Scholarship[]; error?: string };
      if (!res.ok) {
        setMatchError(json.error ?? "Couldn't fetch matches.");
      } else {
        const top = (json.matches ?? []).slice(0, 6);
        setMatches(top);
        try {
          localStorage.setItem(
            MATCH_CACHE_KEY,
            JSON.stringify({ at: Date.now(), matches: top }),
          );
        } catch {
          // ignore
        }
      }
    } catch {
      setMatchError("Couldn't fetch matches.");
    } finally {
      setMatchesLoading(false);
    }
  };

  // ── Hero "next action" priority ──
  const nextAction = useMemo(() => {
    if (!data) return null;

    const closingThisWeek = data.bookmarksClosingSoon.filter((s) => {
      const d = daysRemaining(s.deadline);
      return d !== null && d >= 0 && d <= 7;
    });

    if (closingThisWeek.length > 0) {
      return {
        kind: "urgent" as const,
        titleKey: closingThisWeek.length === 1
          ? "1 bookmarked scholarship closes this week"
          : `${closingThisWeek.length} bookmarked scholarships close this week`,
        descriptionKey: "Time to finalise your applications. Open them and check what's left.",
        ctaLabel: "Review now",
        ctaHref: `/scholarships/${closingThisWeek[0].id}`,
      };
    }

    if (data.stats.readiness < 50) {
      return {
        kind: "profile" as const,
        titleKey: "Complete your profile to unlock better matches",
        descriptionKey: `You're ${data.stats.readiness}% there. The more we know, the more accurate the AI matches.`,
        ctaLabel: "Update profile",
        ctaHref: "/profile",
      };
    }

    if (data.stats.bookmarksCount === 0) {
      return {
        kind: "explore" as const,
        titleKey: "Find your first scholarship match",
        descriptionKey: "Browse the catalog or chat with the mentor to discover where you'd qualify.",
        ctaLabel: "Browse scholarships",
        ctaHref: "/scholarships",
      };
    }

    if (data.stats.newScholarshipsCount > 0) {
      return {
        kind: "fresh" as const,
        titleKey: data.stats.newScholarshipsCount === 1
          ? "1 new scholarship added this week"
          : `${data.stats.newScholarshipsCount} new scholarships added this week`,
        descriptionKey: "Worth a quick look — they might fit your profile.",
        ctaLabel: "See what's new",
        ctaHref: "/scholarships",
      };
    }

    return {
      kind: "default" as const,
      titleKey: "You're all caught up",
      descriptionKey: "Keep refining your profile and ask the mentor when something comes to mind.",
      ctaLabel: "Open mentor",
      ctaHref: "/chat",
    };
  }, [data]);

  if (loading || !data) {
    return (
      <AuthGuard>
        <div className={styles.page}>
          <AppNavbar actions={[{ label: t("nav.signOut"), onClick: signOut }]} />
          <main className={styles.main}>
            <div className={styles.skeletonHero}>
              <div className={styles.skeletonLine} style={{ width: "60px", height: "12px" }} />
              <div className={styles.skeletonLine} style={{ width: "200px", height: "36px" }} />
            </div>
            <div className={styles.skeletonCard} style={{ height: "110px" }} />
            <div className={styles.row}>
              <div className={styles.skeletonCard} style={{ height: "260px" }} />
              <div className={styles.skeletonCard} style={{ height: "260px" }} />
            </div>
            <div className={styles.row}>
              <div className={styles.skeletonCard} style={{ height: "130px" }} />
              <div className={styles.skeletonCard} style={{ height: "130px" }} />
            </div>
          </main>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className={styles.page}>
        <AppNavbar actions={[{ label: t("nav.signOut"), onClick: signOut }]} />

        <main className={styles.main} data-mobile-tab={mobileTab}>
          {/* ── Hero: greeting + next action ── */}
          <section className={styles.heroStrip}>
            <div className={styles.heroIntro}>
              <p className={styles.kicker}>{t(greetingKeyFor())}</p>
              <h1>{data.user.name}</h1>
              <ul className={styles.heroStats}>
                <li className={styles.heroStat} data-tone="teal">
                  <UserIcon />
                  <strong>{data.stats.readiness}</strong>
                  {t("dashboard.complete")}
                </li>
                <li className={styles.heroStat} data-tone="sand">
                  <BookmarkIcon />
                  <strong>{data.stats.bookmarksCount}</strong> {t("dashboard.saved")}
                </li>
                {data.bookmarksClosingSoon.length > 0 && (
                  <li className={styles.heroStat} data-tone="coral">
                    <ClockIcon />
                    <strong>{data.bookmarksClosingSoon.length}</strong> {t("dashboard.closingSoon")}
                  </li>
                )}
              </ul>
            </div>

            {nextAction && (
              <div className={`${styles.actionCard} ${styles[`action_${nextAction.kind}`]}`}>
                <span className={styles.actionIcon} aria-hidden="true">
                  {nextAction.kind === "urgent" ? (
                    <ClockIcon />
                  ) : nextAction.kind === "profile" ? (
                    <UserIcon />
                  ) : (
                    <SparkleIcon />
                  )}
                </span>
                <div className={styles.actionBody}>
                  <p className={styles.actionLabel}>{t("dashboard.whatNext")}</p>
                  <h2>{nextAction.titleKey}</h2>
                  <p>{nextAction.descriptionKey}</p>
                </div>
                <Link href={nextAction.ctaHref} className={styles.actionCta}>
                  {nextAction.ctaLabel} →
                </Link>
              </div>
            )}
          </section>

          {/* ── CV Builder promo ── */}
          <Link href="/cv-builder" className={styles.cvPromo}>
            <span className={styles.cvPromoIcon} aria-hidden="true">
              <SparkleIcon />
            </span>
            <div className={styles.cvPromoBody}>
              <p className={styles.cvPromoKicker}>New · AI-powered</p>
              <h3>Build a standout academic CV</h3>
              <p className={styles.cvPromoDesc}>
                Analyze your current CV for instant feedback, then create a committee-ready CV
                from a proven template.
              </p>
            </div>
            <span className={styles.cvPromoCta} aria-hidden="true">
              Open CV Builder →
            </span>
          </Link>

          {/* Mobile-only segmented control — desktop hides this and shows all sections */}
          <nav
            className={styles.mobileTabs}
            role="tablist"
            aria-label="Dashboard sections"
          >
            {(
              [
                { id: "today" as const, label: t("dashboard.today") },
                { id: "bookmarks" as const, label: t("dashboard.bookmarks") },
                { id: "profile" as const, label: t("dashboard.profile") },
              ]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mobileTab === tab.id}
                className={`${styles.mobileTabsButton} ${
                  mobileTab === tab.id ? styles.mobileTabsButtonActive : ""
                }`}
                onClick={() => setMobileTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* ── AI picks + bookmarks closing soon ── */}
          <section className={styles.row} data-mobile-section="today">
            {/* AI Match */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div className={styles.panelHeadingGroup}>
                  <span className={styles.panelIcon} data-tone="teal" aria-hidden="true">
                    <SparkleIcon />
                  </span>
                  <div>
                    <p className={styles.kickerLight}>{t("dashboard.forYou")}</p>
                    <h3>{t("dashboard.aiPicks")}</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={refreshMatches}
                  className={styles.linkButton}
                  disabled={matchesLoading}
                >
                  {matchesLoading ? t("dashboard.refreshing") : t("dashboard.refresh")}
                </button>
              </div>

              {matchesLoading && matches.length === 0 ? (
                <p className={styles.muted}>{t("dashboard.analysingProfile")}</p>
              ) : matchError ? (
                <div className={styles.matchEmpty}>
                  <p>{matchError}</p>
                  {data.stats.readiness < 30 && (
                    <Link href="/profile" className={styles.linkInline}>
                      {t("dashboard.updateProfileForMatches")}
                    </Link>
                  )}
                </div>
              ) : matches.length === 0 ? (
                <div className={styles.matchEmpty}>
                  <p>{t("dashboard.noMatchesYet")}</p>
                  <Link href="/profile" className={styles.linkInline}>
                    {t("dashboard.updateProfile")}
                  </Link>
                </div>
              ) : (
                <ul className={styles.matchList}>
                  {matches.slice(0, 4).map((m) => (
                    <li key={m.id}>
                      <Link href={`/scholarships/${m.id}`} className={styles.matchItem}>
                        <div className={styles.matchThumb}>
                          {m.thumbnail_url ? (
                            <Image
                              src={m.thumbnail_url}
                              alt=""
                              width={56}
                              height={56}
                              loading="lazy"
                              sizes="56px"
                            />
                          ) : (
                            <span aria-hidden="true">🎓</span>
                          )}
                        </div>
                        <div className={styles.matchBody}>
                          <h4>{m.title}</h4>
                          <p>
                            {m.country}
                            {m.funding_type ? ` · ${m.funding_type}` : ""}
                            {m.deadline ? ` · ${t("dashboard.deadlineLabel")} ${formatDeadlineShort(m.deadline)}` : ""}
                          </p>
                        </div>
                        <span className={styles.matchArrow} aria-hidden="true">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Closing soon (from bookmarks) */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div className={styles.panelHeadingGroup}>
                  <span className={styles.panelIcon} data-tone="coral" aria-hidden="true">
                    <ClockIcon />
                  </span>
                  <div>
                    <p className={styles.kickerLight}>
                      <span className={styles.liveDot} aria-hidden="true" />
                      {t("dashboard.closingSoon")}
                    </p>
                    <h3>{t("dashboard.bookmarksWithDeadlines")}</h3>
                  </div>
                </div>
                <Link href="/scholarships?sort=deadline" className={styles.linkButton}>
                  {t("dashboard.seeAll")}
                </Link>
              </div>

              {data.bookmarksClosingSoon.length === 0 ? (
                <div className={styles.matchEmpty}>
                  <p>
                    {t("dashboard.nothingClosingBookmarks")}{" "}
                    <Link href="/scholarships" className={styles.linkInline}>
                      {t("dashboard.scholarshipsPageLink")}
                    </Link>{" "}
                    {t("dashboard.trackDeadlines")}
                  </p>
                </div>
              ) : (
                <ul className={styles.deadlineList}>
                  {data.bookmarksClosingSoon.map((s) => {
                    const d = daysRemaining(s.deadline);
                    const urgent = d !== null && d >= 0 && d <= 7;
                    return (
                      <li key={s.id}>
                        <Link
                          href={`/scholarships/${s.id}`}
                          className={`${styles.deadlineItem} ${urgent ? styles.deadlineItemUrgent : ""}`}
                        >
                          <div>
                            <h4>{s.title}</h4>
                            <p>
                              {s.country}
                              {s.degree_level ? ` · ${s.degree_level}` : ""}
                            </p>
                          </div>
                          <span className={styles.deadlineBadge}>
                            {d === null ? t("label.open") : d < 0 ? t("label.closed") : `${d}${t("label.dLeft")}`}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* ── Profile completeness + Resume chat ── */}
          <section className={styles.row} data-mobile-section="profile">
            {/* Profile completeness */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div className={styles.panelHeadingGroup}>
                  <span className={styles.panelIcon} data-tone="teal" aria-hidden="true">
                    <UserIcon />
                  </span>
                  <div>
                    <p className={styles.kickerLight}>{t("dashboard.yourProfile")}</p>
                    <h3>
                      <strong className={styles.readinessNum}>{data.stats.readiness}</strong>
                      {t("dashboard.complete")}
                    </h3>
                  </div>
                </div>
              </div>
              <div className={styles.progressTrack} aria-hidden="true">
                <span
                  className={styles.progressFill}
                  style={{ width: `${Math.max(4, data.stats.readiness)}%` }}
                />
              </div>
              {data.stats.missingFields.length > 0 ? (
                <p className={styles.muted}>
                  {t("dashboard.stillMissing")}{" "}
                  <strong>{data.stats.missingFields.slice(0, 3).join(", ")}</strong>
                  {data.stats.missingFields.length > 3
                    ? ` (+${data.stats.missingFields.length - 3} more)`
                    : ""}
                </p>
              ) : (
                <p className={styles.muted}>{t("dashboard.allSet")}</p>
              )}
              <Link href="/profile" className={styles.profileCta}>
                {data.stats.readiness === 100
                  ? t("dashboard.editProfile")
                  : data.stats.readiness === 0
                    ? t("dashboard.setupProfile")
                    : t("dashboard.completeProfile")}
              </Link>
              <button
                type="button"
                className={styles.signOutBtn}
                onClick={signOut}
              >
                {t("dashboard.signOut")}
              </button>
            </div>

            {/* Continue chat */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div className={styles.panelHeadingGroup}>
                  <span className={styles.panelIcon} data-tone="teal" aria-hidden="true">
                    <ChatIcon />
                  </span>
                  <div>
                    <p className={styles.kickerLight}>{t("dashboard.mentor")}</p>
                    <h3>{t("dashboard.continueChatting")}</h3>
                  </div>
                </div>
                <Link href="/chat" className={styles.linkButton}>
                  {t("dashboard.open")}
                </Link>
              </div>

              {data.lastSession ? (
                <Link
                  href={`/chat?session=${data.lastSession.id}`}
                  className={styles.lastSessionItem}
                >
                  <div>
                    <h4>{data.lastSession.title || t("dashboard.untitledChat")}</h4>
                    {data.lastSession.preview && (
                      <p className={styles.lastSessionPreview}>
                        {data.lastSession.preview}
                        {data.lastSession.preview.length >= 120 ? "…" : ""}
                      </p>
                    )}
                  </div>
                  <span className={styles.muted}>
                    {relative(data.lastSession.updated_at)}
                  </span>
                </Link>
              ) : (
                <div className={styles.matchEmpty}>
                  <p>{t("dashboard.noChatsYet")}</p>
                  <Link href="/chat" className={styles.linkInline}>
                    {t("dashboard.startChatting")}
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* ── All bookmarks (collapsed) ── */}
          {data.bookmarks.length > 0 && (
            <section className={styles.panel} data-mobile-section="bookmarks">
              <div className={styles.panelHeader}>
                <div className={styles.panelHeadingGroup}>
                  <span className={styles.panelIcon} data-tone="sand" aria-hidden="true">
                    <BookmarkIcon />
                  </span>
                  <div>
                    <p className={styles.kickerLight}>{t("dashboard.saved")}</p>
                    <h3>{t("dashboard.allBookmarks")} ({data.bookmarks.length})</h3>
                  </div>
                </div>
              </div>

              <ul className={styles.bookmarkGrid}>
                {data.bookmarks.map((s) => (
                  <li key={s.id}>
                    <Link href={`/scholarships/${s.id}`} className={styles.bookmarkCard}>
                      <h4>{s.title}</h4>
                      <p className={styles.bookmarkMeta}>
                        <span>{s.country}</span>
                        {s.deadline && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{t("dashboard.deadlineLabel")} {formatDeadlineShort(s.deadline)}</span>
                          </>
                        )}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

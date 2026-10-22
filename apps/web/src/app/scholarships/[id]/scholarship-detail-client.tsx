"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDialog } from "@/components/ui/dialog-provider";
import ScholarshipAiPanel from "@/components/scholarship-ai-panel/scholarship-ai-panel";
import { CompetitivenessGauge } from "./competitiveness-gauge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./detail.module.css";

type SummaryTab = "Overview" | "Competitiveness";

const TABS: SummaryTab[] = ["Overview", "Competitiveness"];

// Generic, level-appropriate guidance — the checklist and tips get their own
// dedicated, always-visible sections below, so this tab focuses purely on
// interpreting the competitiveness level rather than repeating them.
const COMPETITIVENESS_BLURB: Record<string, string> = {
  low: "Fewer applicants compete for each seat here. Meeting the core eligibility requirements gives you a solid shot.",
  medium:
    "A moderate number of students apply. Meeting the requirements is a good start — a polished SOP and CV will help you stand out from the pool.",
  high: "This is a sought-after scholarship with many applicants per seat. A strong academic record and a compelling, well-prepared application matter a lot here.",
};

export type ScholarshipForClient = {
  id: string;
  title: string;
  country: string;
  degree_level: string;
  funding_type: string;
  deadline: string | null;
  official_url: string | null;
  eligibility_summary: string | null;
  competitiveness: string | null;
  tips: string | null;
  tags: string[] | null;
  ai_summary: string | null;
};

interface Props {
  scholarship: ScholarshipForClient;
}

/**
 * Client island for the scholarship detail page.
 * Handles: the AI summary tabs, the AI chat panel, and the mobile sticky bar.
 * Receives all scholarship data as props — no client-side data fetch needed.
 */
export default function ScholarshipDetailClient({ scholarship }: Props) {
  const { userId } = useAuth();
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState<SummaryTab>("Overview");
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Sync bookmark state for the mobile sticky bar
  useEffect(() => {
    if (!userId) {
      setIsBookmarked(false);
      return;
    }
    fetch("/api/bookmarks")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { bookmarks?: { scholarship_id: string }[] } | null) => {
        const ids = data?.bookmarks?.map((b) => b.scholarship_id) ?? [];
        setIsBookmarked(ids.includes(scholarship.id));
      })
      .catch(() => setIsBookmarked(false));
  }, [userId, scholarship.id]);

  const handleBookmark = async () => {
    if (!userId) {
      await dialog.alert({
        title: "Sign in required",
        description: "Please sign in to save scholarships.",
      });
      return;
    }
    setIsBookmarking(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scholarship_id: scholarship.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsBookmarked(true);
        await dialog.alert({
          title: data.already ? "Already bookmarked" : "Success",
          description: data.already
            ? "This scholarship is already in your bookmarks!"
            : "Saved to bookmarks!",
        });
      } else {
        await dialog.alert({ title: "Error", description: "Failed to bookmark." });
      }
    } catch {
      await dialog.alert({ title: "Error", description: "Error saving bookmark." });
    }
    setIsBookmarking(false);
  };

  return (
    <>
      {/* ── AI summary — framed as the article intro, not a tool output ── */}
      <section className={`${styles.summarySection} ${styles.sectionRule}`}>
        <div className={styles.summaryHeader}>
          <div className={styles.summaryHeaderText}>
            <span className={styles.eyebrow}>Overview</span>
            <h2 className={styles.sectionHeading}>What this scholarship offers</h2>
          </div>
          <div className={styles.tabRow}>
            {TABS.map((tab) => (
              <button
                key={tab}
                data-tab={tab}
                className={tab === activeTab ? styles.tabActive : styles.tabButton}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Both panels render into the DOM (so Overview stays crawlable for
            SEO) — only the active one is visually shown. */}
        <div className={styles.markdownBody} hidden={activeTab !== "Overview"}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {scholarship.ai_summary ?? "No summary available yet."}
          </ReactMarkdown>
        </div>

        <div hidden={activeTab !== "Competitiveness"}>
          {scholarship.competitiveness ? (
            <>
              <CompetitivenessGauge level={scholarship.competitiveness} />
              <p className={styles.markdownBody} style={{ marginTop: 14 }}>
                {COMPETITIVENESS_BLURB[scholarship.competitiveness.toLowerCase()] ??
                  "Review the eligibility checklist and tips below to gauge your fit."}
              </p>
            </>
          ) : (
            <p className={styles.markdownBody}>
              Competitiveness analysis not yet available.
            </p>
          )}
        </div>
      </section>

      {/* ── AI contextual chat panel ── */}
      <ScholarshipAiPanel
        scholarshipId={scholarship.id}
        scholarshipTitle={scholarship.title}
      />

      {/* ── Mobile-only sticky action bar ── */}
      <div className={styles.mobileStickyBar}>
        <button
          type="button"
          className={`${styles.mobileStickyBookmark} ${
            isBookmarked ? styles.mobileStickyBookmarkActive : ""
          }`}
          onClick={handleBookmark}
          disabled={isBookmarking || isBookmarked}
          aria-label={isBookmarked ? "Bookmarked" : "Save to bookmarks"}
          aria-pressed={isBookmarked}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={isBookmarked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {scholarship.official_url ? (
          <a
            className={styles.mobileStickyApply}
            href={scholarship.official_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Apply now ↗
          </a>
        ) : (
          <button
            type="button"
            className={styles.mobileStickyApply}
            disabled
            aria-disabled="true"
            style={{ opacity: 0.6 }}
          >
            No official link yet
          </button>
        )}
      </div>
    </>
  );
}

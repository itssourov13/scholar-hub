"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useDialog } from "@/components/ui/dialog-provider";
import { CompetitivenessGauge } from "./competitiveness-gauge";
import styles from "./detail.module.css";

export type ScholarshipForPanel = {
  id: string;
  official_url: string | null;
  competitiveness: string | null;
  tags: string[] | null;
};

interface Props {
  scholarship: ScholarshipForPanel;
}

/**
 * Client island for the scholarship hero right-column panel.
 * Handles bookmark state, apply button, and quick facts.
 */
export default function ScholarshipHeroPanelClient({ scholarship }: Props) {
  const { userId } = useAuth();
  const dialog = useDialog();
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

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
    <div className={styles.heroPanel}>
      <div className={styles.heroActions}>
        <a className={styles.ghostButton} href="/scholarships">
          Back to list
        </a>
        {scholarship.official_url && (
          <a
            className={styles.primaryButton}
            href={scholarship.official_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Apply now ↗
          </a>
        )}
      </div>

      <h3>Quick facts</h3>
      <CompetitivenessGauge level={scholarship.competitiveness} compact />
      {scholarship.tags && scholarship.tags.length > 0 && (
        <div className={styles.tagRow} style={{ marginTop: 14 }}>
          {scholarship.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}

      <div className={styles.heroPanelFooter}>
        {isBookmarked ? (
          <button
            className={styles.secondaryButton}
            disabled
            style={{ flex: 1, textAlign: "center", opacity: 0.7, cursor: "default" }}
          >
            Bookmarked
          </button>
        ) : (
          <button
            className={styles.secondaryButton}
            onClick={handleBookmark}
            disabled={isBookmarking}
            style={{ flex: 1, textAlign: "center" }}
          >
            {isBookmarking ? "Saving..." : "Save to Bookmarks"}
          </button>
        )}
        {scholarship.official_url && (
          <a
            className={styles.primaryButton}
            href={scholarship.official_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, textAlign: "center" }}
          >
            Official page ↗
          </a>
        )}
      </div>
    </div>
  );
}

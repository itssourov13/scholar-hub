"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../admin.module.css";

type GuideRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: "draft" | "published" | "archived";
  faqs: unknown[];
  published_at: string | null;
  created_at: string;
  is_pinned: boolean;
};

export default function AdminGuidesPage() {
  const [guides, setGuides] = useState<GuideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/guides")
      .then((r) => r.json())
      .then(({ guides = [] }) => setGuides(guides))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const publish = async (id: string) => {
    setActionId(id);
    await fetch(`/api/admin/guides/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    setActionId(null);
    load();
  };

  const unpublish = async (id: string) => {
    setActionId(id);
    await fetch(`/api/admin/guides/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });
    setActionId(null);
    load();
  };

  const togglePin = async (id: string, currentlyPinned: boolean) => {
    setActionId(id);
    await fetch(`/api/admin/guides/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_pinned: !currentlyPinned }),
    });
    setActionId(null);
    load();
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setActionId(id);
    await fetch(`/api/admin/guides/${id}`, { method: "DELETE" });
    setActionId(null);
    load();
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin</p>
          <h1>Guides</h1>
          <p className={styles.sub}>AI-assisted study abroad guides for SEO</p>
        </div>
        <Link href="/admin/guides/new" className={styles.primaryBtn}>
          ✨ New guide
        </Link>
      </header>

      {loading ? (
        <div className={styles.emptyState}>
          <span>Loading…</span>
        </div>
      ) : guides.length === 0 ? (
        <div className={styles.emptyState}>
          <span style={{ fontSize: 36 }}>📝</span>
          <p>No guides yet. Create your first one with AI assistance.</p>
          <Link href="/admin/guides/new" className={styles.primaryBtn}>
            ✨ New guide
          </Link>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader} style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1.5fr" }}>
            <span>Title</span>
            <span>Category</span>
            <span>Status</span>
            <span>FAQs</span>
            <span>Actions</span>
          </div>
          {guides.map((g) => (
            <div
              key={g.id}
              className={styles.tableRow}
              style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1.5fr" }}
            >
              <div className={styles.titleCell}>
                {g.is_pinned && (
                  <span title="Pinned to position 1" style={{ fontSize: 14 }}>📌</span>
                )}
                <span>{g.title}</span>
              </div>
              <span style={{ fontSize: 12, color: "var(--ink-500)" }}>{g.category}</span>
              <span>
                <span
                  className={`${styles.badge} ${
                    g.status === "published" ? styles.badge_published : styles.badge_draft
                  }`}
                >
                  {g.status}
                </span>
              </span>
              <span style={{ fontSize: 13, color: "var(--ink-500)" }}>
                {Array.isArray(g.faqs) ? g.faqs.length : 0}
              </span>
              <div className={styles.actions}>
                <Link
                  href={`/admin/guides/${g.id}`}
                  className={styles.actionBtn}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${g.is_pinned ? styles.pinActiveBtn : styles.pinBtn}`}
                  onClick={() => togglePin(g.id, g.is_pinned)}
                  disabled={actionId === g.id}
                  title={g.is_pinned ? "Unpin from position 1" : "Pin to position 1"}
                >
                  {g.is_pinned ? "📌 Pinned" : "📍 Pin"}
                </button>
                {g.status !== "published" ? (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.publishBtn}`}
                    onClick={() => publish(g.id)}
                    disabled={actionId === g.id}
                  >
                    Publish
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => unpublish(g.id)}
                    disabled={actionId === g.id}
                  >
                    Unpublish
                  </button>
                )}
                {g.status === "published" && (
                  <a
                    href={`/guide/${g.slug}`}
                    target="_blank"
                    rel="noopener"
                    className={styles.actionBtn}
                  >
                    View ↗
                  </a>
                )}
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.archiveBtn}`}
                  onClick={() => remove(g.id, g.title)}
                  disabled={actionId === g.id}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDialog } from "@/components/ui/dialog-provider";
import styles from "../admin.module.css";

type Scholarship = {
  id: string;
  title: string;
  country: string;
  status: "draft" | "published" | "archived";
  degree_level: string;
  funding_type: string;
  deadline: string | null;
  updated_at: string;
  thumbnail_url: string | null;
  is_flagship: boolean;
  bangladeshi_eligible: boolean | null;
};

type TelegramModal = {
  id: string;
  title: string;
  text: string;
  url: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export default function AdminScholarshipsPage() {
  const [items, setItems] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingestingId, setIngestingId] = useState<string | null>(null);
  const [ingestingAll, setIngestingAll] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [generatingTelegramId, setGeneratingTelegramId] = useState<string | null>(null);
  const [telegramModal, setTelegramModal] = useState<TelegramModal | null>(null);
  const [copied, setCopied] = useState(false);
  const dialog = useDialog();

  const load = () => {
    setLoading(true);
    fetch("/api/admin/scholarships")
      .then((r) => r.json())
      .then(({ scholarships }) => setItems(scholarships ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const publish = async (id: string) => {
    await fetch(`/api/admin/scholarships/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    load();
  };

  const toggleFlagship = async (id: string, current: boolean) => {
    await fetch(`/api/admin/scholarships/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_flagship: !current }),
    });
    load();
  };

  const archive = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: "Archive Scholarship",
      description: "Are you sure you want to archive this scholarship? It will be hidden from students.",
      isDestructive: true,
      confirmText: "Archive",
    });
    if (!confirmed) return;
    await fetch(`/api/admin/scholarships/${id}`, { method: "DELETE" });
    load();
  };

  const deletePermanently = async (id: string, title: string) => {
    const confirmed = await dialog.confirm({
      title: "Permanently Delete Scholarship",
      description: `This will permanently delete "${title}" and cannot be undone. All associated data including embeddings will be removed.`,
      isDestructive: true,
      confirmText: "Delete Forever",
    });
    if (!confirmed) return;
    await fetch(`/api/admin/scholarships/${id}?permanent=true`, { method: "DELETE" });
    load();
  };

  const ingest = async (id: string) => {
    setIngestingId(id);
    setIngestStatus(null);
    const res = await fetch(`/api/admin/scholarships/${id}/ingest`, { method: "POST" });
    const data = await res.json();
    setIngestingId(null);
    if (res.ok) {
      setIngestStatus(`✅ Ingested "${items.find(s => s.id === id)?.title}" — ${data.chunks} chunks`);
    } else {
      setIngestStatus(`❌ Ingest failed: ${data.error}`);
    }
  };

  const ingestAll = async () => {
    const confirmed = await dialog.confirm({
      title: "Ingest All Scholarships",
      description: "This will generate embeddings for all published scholarships so AI Match works. It may take 1–3 minutes depending on how many scholarships you have. Continue?",
      confirmText: "Yes, ingest all",
    });
    if (!confirmed) return;
    setIngestingAll(true);
    setIngestStatus(null);
    const res = await fetch("/api/admin/scholarships/ingest-all", { method: "POST" });
    const data = await res.json();
    setIngestingAll(false);
    if (res.ok) {
      setIngestStatus(`✅ Batch complete — ${data.succeeded} succeeded, ${data.failed} failed`);
    } else {
      setIngestStatus(`❌ Batch ingest failed: ${data.error}`);
    }
  };

  const generateTelegramUpdate = async (scholarship: Scholarship) => {
    setGeneratingTelegramId(scholarship.id);
    setCopied(false);
    try {
      const res = await fetch(`/api/admin/scholarships/${scholarship.id}/telegram-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "deepseek" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      setTelegramModal({
        id: scholarship.id,
        title: scholarship.title,
        text: data.text,
        url: data.url,
      });
    } catch (err) {
      setIngestStatus(`❌ Telegram update failed: ${String(err)}`);
    } finally {
      setGeneratingTelegramId(null);
    }
  };

  const regenerateTelegramUpdate = async () => {
    if (!telegramModal) return;
    const scholarship = items.find(s => s.id === telegramModal.id);
    if (!scholarship) return;
    setGeneratingTelegramId(scholarship.id);
    setCopied(false);
    try {
      const res = await fetch(`/api/admin/scholarships/${scholarship.id}/telegram-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "deepseek" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to regenerate");
      setTelegramModal(prev => prev ? { ...prev, text: data.text } : null);
    } catch (err) {
      setIngestStatus(`❌ Regenerate failed: ${String(err)}`);
    } finally {
      setGeneratingTelegramId(null);
    }
  };

  const copyTelegramText = async () => {
    if (!telegramModal) return;
    try {
      await navigator.clipboard.writeText(telegramModal.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = telegramModal.text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin</p>
          <h1>Scholarships</h1>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            className={styles.actionBtn}
            onClick={ingestAll}
            disabled={ingestingAll}
            title="Generate AI embeddings for all published scholarships (required for AI Match)"
            style={{ background: "var(--teal-600, #0d9488)", color: "#fff", border: "none", cursor: ingestingAll ? "wait" : "pointer" }}
          >
            {ingestingAll ? "Ingesting…" : "⚡ Ingest All"}
          </button>
          <Link href="/admin/scholarships/bulk" className={styles.actionBtn} style={{ borderColor: "rgba(124, 58, 237, 0.35)", color: "#6d28d9" }}>
            🧪 Bulk Import
          </Link>
          <Link href="/admin/scholarships/new" className={styles.primaryBtn}>
            + Add scholarship
          </Link>
        </div>
      </header>

      {ingestStatus && (
        <p style={{ margin: "0 0 16px", fontSize: "13px", padding: "10px 14px", background: "var(--sand-100, #f5f4f0)", borderRadius: "8px", border: "1px solid var(--sand-200, #e8e5dc)" }}>
          {ingestStatus}
        </p>
      )}

      {loading ? (
        <p className={styles.sub}>Loading…</p>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No scholarships yet.</p>
          <Link href="/admin/scholarships/new" className={styles.primaryBtn}>
            Add your first scholarship
          </Link>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>Title</span>
            <span>Country</span>
            <span>Level</span>
            <span>Deadline</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {items.map((s) => (
            <div key={s.id} className={styles.tableRow}>
              <span className={styles.titleCell}>
                {s.thumbnail_url && (
                  <img src={s.thumbnail_url} alt="" className={styles.rowThumb} />
                )}
                {s.is_flagship && (
                  <span title="Flagship" style={{ marginRight: 4, fontSize: 14 }}>⭐</span>
                )}
                {s.bangladeshi_eligible === false && (
                  <span
                    title="Not applicable for Bangladeshi students"
                    style={{ marginRight: 4, fontSize: 11, fontWeight: 700, color: "#b91c1c", background: "#fee2e2", padding: "2px 6px", borderRadius: 999 }}
                  >
                    🚫 Not BD
                  </span>
                )}
                {s.title}
              </span>
              <span>{s.country}</span>
              <span>{s.degree_level ?? "—"}</span>
              <span>{s.deadline || "—"}</span>
              <span>
                <span className={`${styles.badge} ${styles[`badge_${s.status}`]}`}>
                  {STATUS_LABELS[s.status]}
                </span>
              </span>
              <span className={styles.actions}>
                <Link href={`/admin/scholarships/${s.id}/edit`} className={styles.actionBtn}>
                  Edit
                </Link>
                <button
                  className={styles.actionBtn}
                  onClick={() => toggleFlagship(s.id, s.is_flagship)}
                  title={s.is_flagship ? "Remove from featured" : "Mark as featured (shown first)"}
                  style={{
                    background: s.is_flagship ? "var(--amber-100, #fef3c7)" : undefined,
                    color: s.is_flagship ? "var(--amber-700, #b45309)" : undefined,
                    borderColor: s.is_flagship ? "var(--amber-300, #fcd34d)" : undefined,
                  }}
                >
                  {s.is_flagship ? "★ Unfeature" : "☆ Feature"}
                </button>
                <button
                  className={styles.actionBtn}
                  onClick={() => ingest(s.id)}
                  disabled={ingestingId === s.id}
                  title="Generate embeddings for AI Match"
                  style={{ opacity: ingestingId === s.id ? 0.6 : 1 }}
                >
                  {ingestingId === s.id ? "Ingesting…" : "Ingest"}
                </button>
                <button
                  className={styles.telegramGenBtn}
                  onClick={() => generateTelegramUpdate(s)}
                  disabled={generatingTelegramId === s.id}
                  title="Generate Bangla Telegram update for this scholarship"
                >
                  {generatingTelegramId === s.id ? (
                    <>
                      <span className={styles.spinner} style={{ borderColor: "rgba(14,114,160,0.3)", borderTopColor: "#0e72a0" }} />
                      Generating…
                    </>
                  ) : (
                    <>✈️ Telegram</>
                  )}
                </button>
                {s.status !== "published" && (
                  <button
                    className={`${styles.actionBtn} ${styles.publishBtn}`}
                    onClick={() => publish(s.id)}
                  >
                    Publish
                  </button>
                )}
                {s.status !== "archived" && (
                  <button
                    className={`${styles.actionBtn} ${styles.archiveBtn}`}
                    onClick={() => archive(s.id)}
                  >
                    Archive
                  </button>
                )}
                <button
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={() => deletePermanently(s.id, s.title)}
                  title="Permanently delete this scholarship"
                >
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Telegram Update Modal */}
      {telegramModal && (
        <div
          className={styles.telegramOverlay}
          onClick={(e) => { if (e.target === e.currentTarget) setTelegramModal(null); }}
        >
          <div className={styles.telegramModal}>
            <div className={styles.telegramModalHeader}>
              <div>
                <p className={styles.telegramModalTitle}>✈️ Telegram Update</p>
                <p className={styles.telegramModalSub}>{telegramModal.title}</p>
              </div>
              <button
                className={styles.telegramCloseBtn}
                onClick={() => setTelegramModal(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className={styles.telegramTextBox}>
              {generatingTelegramId === telegramModal.id ? (
                <span style={{ color: "var(--ink-400, #94a3b8)", fontStyle: "italic" }}>Generating new update…</span>
              ) : (
                telegramModal.text
              )}
            </div>

            <div style={{ fontSize: "12px", color: "var(--ink-500, #6b7c8d)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>🔗</span>
              <a
                href={telegramModal.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--teal-700, #0a6b6a)", textDecoration: "underline", wordBreak: "break-all" }}
              >
                {telegramModal.url}
              </a>
            </div>

            <div className={styles.telegramActions}>
              <button
                className={`${styles.telegramCopyBtn} ${copied ? styles.telegramCopyBtnDone : ""}`}
                onClick={copyTelegramText}
                disabled={generatingTelegramId === telegramModal.id}
              >
                {copied ? "✅ Copied!" : "📋 Copy to Clipboard"}
              </button>
              <button
                className={styles.telegramRegenerateBtn}
                onClick={regenerateTelegramUpdate}
                disabled={generatingTelegramId === telegramModal.id}
                title="Generate a fresh variation"
              >
                {generatingTelegramId === telegramModal.id ? (
                  <>
                    <span className={styles.spinner} style={{ borderColor: "rgba(0,0,0,0.15)", borderTopColor: "#555" }} />
                    Regenerating…
                  </>
                ) : (
                  <>🔄 Regenerate</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

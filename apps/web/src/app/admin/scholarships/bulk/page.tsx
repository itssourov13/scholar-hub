"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import adminStyles from "../../admin.module.css";
import styles from "./bulk.module.css";
import { parseBulkPost, type BulkImportItem } from "@/lib/bulk-import";
import { MODEL_OPTIONS, WEB_SEARCH_MODELS, type ModelChoice } from "@/lib/model-options";

type ItemStatus = "idle" | "processing" | "done" | "duplicate" | "error";

type DupWarning = { id: string; title: string; similarity: number };

type ItemResult = {
  status: ItemStatus;
  scholarshipId?: string;
  slug?: string | null;
  resultTitle?: string;
  error?: string;
  confidenceNote?: string | null;
  scrapeOk?: boolean;
  existingId?: string;
  existingTitle?: string;
  dupWarnings?: DupWarning[];
};

const BULK_MODEL_OPTIONS = MODEL_OPTIONS.filter((m) => WEB_SEARCH_MODELS.includes(m.value));

export default function BulkImportPage() {
  const [rawText, setRawText] = useState("");
  const [items, setItems] = useState<BulkImportItem[]>([]);
  const [model, setModel] = useState<ModelChoice>("deepseek-pro");
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const [running, setRunning] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  const parsePreview = () => {
    setError(null);
    const parsed = parseBulkPost(rawText);
    if (parsed.length === 0) {
      setError("Couldn't find any numbered scholarship entries in that text. Try pasting it as-is from LinkedIn (numbered list, one link per item).");
      return;
    }
    setItems(parsed);
    setResults({});
  };

  const updateItem = (clientId: string, patch: Partial<BulkImportItem>) => {
    setItems((prev) => prev.map((it) => (it.clientId === clientId ? { ...it, ...patch } : it)));
  };

  const removeItem = (clientId: string) => {
    setItems((prev) => prev.filter((it) => it.clientId !== clientId));
  };

  // One internal attempt of the request; returns null on success (state is
  // already updated), or an error string to let the caller decide whether to
  // retry. Safe to call twice for the same item — the server's duplicate
  // guard means a retry after a "secretly succeeded but response got lost"
  // case just reports back as a duplicate instead of double-drafting.
  const attemptOne = async (item: BulkImportItem, force = false): Promise<string | null> => {
    let res: Response;
    try {
      res = await fetch("/api/admin/scholarships/bulk/process-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title, link: item.link, model, force }),
      });
    } catch (err) {
      return `Network error: ${String(err)}`;
    }

    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      // Non-JSON body usually means the platform killed the request (e.g. a
      // function timeout) rather than our route returning a clean error.
      return res.ok ? "Server returned an unreadable response" : `Server error (${res.status}) — likely timed out`;
    }

    if (!res.ok) return (data.error as string | undefined) ?? "Failed";

    if (data.skipped && data.reason === "duplicate") {
      const existing = data.existing as { id?: string; title?: string } | undefined;
      setResults((prev) => ({
        ...prev,
        [item.clientId]: { status: "duplicate", existingId: existing?.id, existingTitle: existing?.title },
      }));
      return null;
    }

    const scholarship = data.scholarship as { id?: string; slug?: string | null; title?: string } | undefined;
    const meta = data.meta as {
      confidenceNote?: string | null;
      scrape?: { ok?: boolean };
      dupWarnings?: DupWarning[];
    } | undefined;
    setResults((prev) => ({
      ...prev,
      [item.clientId]: {
        status: "done",
        scholarshipId: scholarship?.id,
        slug: scholarship?.slug,
        resultTitle: scholarship?.title,
        confidenceNote: meta?.confidenceNote,
        scrapeOk: meta?.scrape?.ok,
        dupWarnings: meta?.dupWarnings,
      },
    }));
    return null;
  };

  // Manual override for a false-positive duplicate match — re-runs the same
  // item with force:true so the server skips its own dedupe guard.
  const forceCreate = async (item: BulkImportItem) => {
    setResults((prev) => ({ ...prev, [item.clientId]: { status: "processing" } }));
    const error = await attemptOne(item, true);
    if (error) setResults((prev) => ({ ...prev, [item.clientId]: { status: "error", error } }));
  };

  const processOne = async (item: BulkImportItem) => {
    setResults((prev) => ({ ...prev, [item.clientId]: { status: "processing" } }));
    setActiveId(item.clientId);

    let error = await attemptOne(item);
    if (error) {
      // One retry after a short pause — covers transient platform timeouts
      // and one-off AI JSON truncation that often doesn't repeat.
      await new Promise((r) => setTimeout(r, 2000));
      setResults((prev) => ({ ...prev, [item.clientId]: { status: "processing" } }));
      error = await attemptOne(item);
    }
    if (error) {
      setResults((prev) => ({ ...prev, [item.clientId]: { status: "error", error } }));
    }
  };

  const runBatch = async () => {
    if (items.length === 0) return;
    setRunning(true);
    stopRef.current = false;
    setError(null);
    for (const item of items) {
      if (stopRef.current) break;
      await processOne(item);
      // small pause between items — gentler on rate limits, lets the UI breathe
      await new Promise((r) => setTimeout(r, 500));
    }
    setRunning(false);
    setActiveId(null);
  };

  const stopBatch = () => {
    stopRef.current = true;
  };

  const doneCount = Object.values(results).filter((r) => r.status === "done").length;
  const dupCount = Object.values(results).filter((r) => r.status === "duplicate").length;
  const errorCount = Object.values(results).filter((r) => r.status === "error").length;
  const processedCount = Object.values(results).filter((r) => r.status !== "idle" && r.status !== "processing").length;
  const finished = items.length > 0 && processedCount === items.length && !running;

  return (
    <div className={adminStyles.page}>
      <header className={adminStyles.header}>
        <div>
          <span className={styles.experimentalBadge}>🧪 Experimental</span>
          <h1>Bulk import scholarships</h1>
          <p className={adminStyles.sub}>
            Paste a numbered list (e.g. a LinkedIn round-up post) — each scholarship is researched and
            saved as a draft for you to review.
          </p>
        </div>
        <Link href="/admin/scholarships" className={adminStyles.ghostBtn}>← Back to Scholarships</Link>
      </header>

      {error && <p className={adminStyles.error}>⚠ {error}</p>}

      <div className={adminStyles.formCard}>
        <p className={styles.intro}>
          Works best with a list like: <code>1. Scholarship Name (Funded)</code> on one line, followed by its
          link on the next. Each item is researched one at a time using live web search (not just the link
          you paste, since aggregator sites often block scraping) plus the model&apos;s own knowledge, then saved
          as a <strong>draft</strong>. Nothing is published automatically — review, add a thumbnail, and
          publish each one yourself afterwards from the Scholarships list.
        </p>

        <div className={adminStyles.pasteSection}>
          <div className={adminStyles.pasteLabelRow}>
            <div>
              <label className={adminStyles.pasteLabel}>Paste the scholarship list</label>
            </div>
            <button
              type="button"
              className={adminStyles.parseBtn}
              onClick={parsePreview}
              disabled={!rawText.trim() || running}
            >
              🔎 Parse list
            </button>
          </div>
          <textarea
            rows={10}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`1. EPFL Master Excellence Scholarship in Switzerland 2027 (Funded)\nhttps://lnkd.in/dj4cfQdg\n\n2. Tsinghua University Scholarships In China 2027 (Fully Funded)\nhttps://lnkd.in/dHbTQYUf\n\n...`}
            className={adminStyles.pasteArea}
            disabled={running}
          />
        </div>

        {items.length > 0 && (
          <>
            <div className={adminStyles.aiControls}>
              <div className={adminStyles.aiControlField}>
                <label htmlFor="bulk-model">AI model</label>
                <select
                  id="bulk-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value as ModelChoice)}
                  disabled={running}
                >
                  {BULK_MODEL_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <span style={{ fontSize: 12, color: "var(--ink-500, #6b7c8d)" }}>
                Both use live web search — pick whichever you&apos;d like to compare.
              </span>
            </div>

            <div className={styles.itemList}>
              {items.map((item, i) => {
                const result = results[item.clientId];
                const status: ItemStatus = result?.status ?? "idle";
                return (
                  <div
                    key={item.clientId}
                    className={styles.itemRow}
                    style={activeId === item.clientId ? { borderColor: "#7c3aed" } : undefined}
                  >
                    <span className={styles.itemIndex}>{i + 1}</span>
                    <input
                      value={item.title}
                      onChange={(e) => updateItem(item.clientId, { title: e.target.value })}
                      disabled={running}
                      placeholder="Scholarship title"
                    />
                    <input
                      value={item.link ?? ""}
                      onChange={(e) => updateItem(item.clientId, { link: e.target.value || null })}
                      disabled={running}
                      placeholder="Link (optional)"
                    />
                    <span className={`${styles.statusPill} ${styles[`status_${status}`]}`}>
                      {status === "processing" && <span className={styles.miniSpinner} />}
                      {status === "idle" && "Queued"}
                      {status === "processing" && "Working…"}
                      {status === "done" && "✓ Draft saved"}
                      {status === "duplicate" && "⚠ Duplicate"}
                      {status === "error" && "✕ Failed"}
                    </span>
                    <button
                      type="button"
                      className={styles.itemRemoveBtn}
                      onClick={() => removeItem(item.clientId)}
                      disabled={running}
                      title="Remove from batch"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            {(running || processedCount > 0) && (
              <div className={styles.progressBarOuter}>
                <div
                  className={styles.progressBarInner}
                  style={{ width: `${items.length ? (processedCount / items.length) * 100 : 0}%` }}
                />
              </div>
            )}

            <div className={adminStyles.formActions}>
              {!running ? (
                <button
                  className={adminStyles.primaryBtn}
                  onClick={runBatch}
                  disabled={items.length === 0}
                >
                  🚀 Start bulk import ({items.length} item{items.length === 1 ? "" : "s"})
                </button>
              ) : (
                <button className={adminStyles.ghostBtn} onClick={stopBatch}>
                  ⏸ Stop after current item
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {processedCount > 0 && (
        <>
          <div className={styles.summaryBar}>
            <span className={styles.summaryStat}>✓ {doneCount} drafted</span>
            <span className={styles.summaryStat}>⚠ {dupCount} duplicate</span>
            <span className={styles.summaryStat}>✕ {errorCount} failed</span>
            {finished && <span className={styles.summaryStat}>🎉 Batch complete</span>}
          </div>

          <div className={styles.resultsList}>
            {items.map((item) => {
              const result = results[item.clientId];
              if (!result || result.status === "idle") return null;
              return (
                <div key={item.clientId} className={styles.resultCard}>
                  <div className={styles.resultHeader}>
                    <span className={styles.resultTitle}>{result.resultTitle ?? item.title}</span>
                    {result.status === "done" && result.scholarshipId && (
                      <Link href={`/admin/scholarships/${result.scholarshipId}/edit`} className={styles.resultLink}>
                        Review draft →
                      </Link>
                    )}
                    {result.status === "duplicate" && result.existingId && (
                      <Link href={`/admin/scholarships/${result.existingId}/edit`} className={styles.resultLink}>
                        View existing →
                      </Link>
                    )}
                  </div>
                  {result.status === "done" && (
                    <p className={styles.resultMeta}>
                      {result.scrapeOk === false && "Source link couldn't be fetched directly — used web search instead. "}
                      {result.confidenceNote && <>ℹ {result.confidenceNote}</>}
                    </p>
                  )}
                  {result.status === "done" && result.dupWarnings && result.dupWarnings.length > 0 && (
                    <p className={styles.resultMeta} style={{ color: "#b45309" }}>
                      ⚠ Similar to an existing entry — please double-check it&apos;s not a duplicate:{" "}
                      {result.dupWarnings.map((w, idx) => (
                        <span key={w.id}>
                          {idx > 0 && ", "}
                          <Link href={`/admin/scholarships/${w.id}/edit`} className={styles.resultLink}>
                            {w.title} ({Math.round(w.similarity * 100)}%)
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                  {result.status === "duplicate" && (
                    <>
                      <p className={styles.resultMeta}>
                        Looks like it matches an existing entry: <strong>{result.existingTitle}</strong>. Skipped to avoid a duplicate draft.
                      </p>
                      <button
                        type="button"
                        className={adminStyles.ghostBtn}
                        style={{ alignSelf: "flex-start", padding: "6px 14px", fontSize: 12 }}
                        onClick={() => forceCreate(item)}
                      >
                        Not a duplicate — create draft anyway
                      </button>
                    </>
                  )}
                  {result.status === "error" && (
                    <p className={styles.resultMeta}>{result.error}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

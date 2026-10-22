"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../../admin.module.css";
import { MAX_COVER_IMAGE_BYTES, formatFileSize } from "@/lib/client-image";
import { MODEL_OPTIONS, type ModelChoice } from "@/lib/model-options";

type FAQ = { question: string; answer: string };

type GuideForm = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  intro: string;
  content: string;
  faqs: FAQ[];
  status: "draft" | "published" | "archived";
  cover_image_url: string;
};

const CATEGORIES = ["Scholarships", "Applications", "Tests", "Destinations", "Visa"];

export default function EditGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [guide, setGuide] = useState<GuideForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingFaq, setEditingFaq] = useState<number | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverSizeError, setCoverSizeError] = useState("");

  // AI-suggested thumbnail prompt
  const [aiModel, setAiModel] = useState<ModelChoice>("deepseek");
  const [thumbPrompt, setThumbPrompt] = useState("");
  const [thumbPromptLoading, setThumbPromptLoading] = useState(false);
  const [thumbPromptError, setThumbPromptError] = useState("");
  const [thumbPromptCopied, setThumbPromptCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/guides/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
          return;
        }
        const g = json.guide;
        setGuide({
          slug: g.slug,
          title: g.title,
          description: g.description ?? "",
          category: g.category ?? "Scholarships",
          tags: g.tags ?? [],
          intro: g.intro ?? "",
          content: g.content ?? "",
          faqs: Array.isArray(g.faqs) ? g.faqs : [],
          status: g.status ?? "draft",
          cover_image_url: g.cover_image_url ?? "",
        });
        if (g.cover_image_url) setCoverPreview(g.cover_image_url);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const onCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_COVER_IMAGE_BYTES) {
      setCoverSizeError(
        `Image size is too big (${formatFileSize(f.size)}). Please reduce it to under ${formatFileSize(MAX_COVER_IMAGE_BYTES)} and try again.`
      );
      e.target.value = "";
      return;
    }
    setCoverSizeError("");
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const handleSuggestThumbPrompt = async () => {
    if (!guide) return;
    setThumbPromptLoading(true);
    setThumbPromptError("");
    try {
      const res = await fetch("/api/admin/guides/thumbnail-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: guide.title,
          category: guide.category,
          intro: guide.intro,
          content: guide.content,
          model: aiModel,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setThumbPromptError(json.error ?? "Failed to generate a prompt.");
        return;
      }
      setThumbPrompt(json.prompt as string);
    } catch (err) {
      setThumbPromptError(String(err));
    } finally {
      setThumbPromptLoading(false);
    }
  };

  const copyThumbPrompt = async () => {
    try {
      await navigator.clipboard.writeText(thumbPrompt);
      setThumbPromptCopied(true);
      setTimeout(() => setThumbPromptCopied(false), 1500);
    } catch {
      // clipboard may be unavailable — admin can select the text manually
    }
  };

  const updateFaq = (index: number, field: "question" | "answer", value: string) => {
    if (!guide) return;
    const updated = [...guide.faqs];
    updated[index] = { ...updated[index], [field]: value };
    setGuide({ ...guide, faqs: updated });
  };

  const removeFaq = (index: number) => {
    if (!guide) return;
    setGuide({ ...guide, faqs: guide.faqs.filter((_, i) => i !== index) });
  };

  const addFaq = () => {
    if (!guide) return;
    setGuide({ ...guide, faqs: [...guide.faqs, { question: "", answer: "" }] });
    setEditingFaq(guide.faqs.length);
  };

  const handleSave = async (newStatus?: GuideForm["status"]) => {
    if (!guide) return;
    setSaving(true);
    setError("");
    try {
      // Cover uploads before the publish PATCH: publishing fires a push
      // notification immediately, and it reads whatever cover_image_url is in
      // the DB at that instant. Uploading after would mean the very first
      // "new guide" push for a guide always went out thumbnail-less.
      if (coverFile) {
        const fd = new FormData();
        fd.append("file", coverFile);
        const upRes = await fetch(`/api/admin/guides/${id}/cover`, { method: "POST", body: fd });
        if (!upRes.ok) {
          const upJson = await upRes.json().catch(() => ({}));
          setError(upJson.error ?? "Cover upload failed.");
          return;
        }
      }

      const res = await fetch(`/api/admin/guides/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: guide.slug,
          title: guide.title,
          description: guide.description,
          category: guide.category,
          tags: guide.tags,
          intro: guide.intro,
          content: guide.content,
          faqs: guide.faqs,
          status: newStatus ?? guide.status,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Guide's cover was updated, but saving the rest failed.");
        return;
      }

      router.push("/admin/guides");
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <p>{error || "Guide not found."}</p>
          <Link href="/admin/guides" className={styles.ghostBtn}>
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin → Guides</p>
          <h1>Edit Guide</h1>
          <p className={styles.sub}>Update content, cover image, and publish status</p>
        </div>
        <Link href="/admin/guides" className={styles.ghostBtn}>
          ← Back
        </Link>
      </header>

      <div className={styles.formCard}>
        <div className={styles.fieldGrid}>
          <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
            <label>Title</label>
            <input
              type="text"
              value={guide.title}
              onChange={(e) => setGuide({ ...guide, title: e.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label>Slug (URL path)</label>
            <input
              type="text"
              value={guide.slug}
              onChange={(e) =>
                setGuide({
                  ...guide,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                })
              }
            />
          </div>
          <div className={styles.field}>
            <label>Category</label>
            <select
              value={guide.category}
              onChange={(e) => setGuide({ ...guide, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
            <label>Meta description (≤155 chars)</label>
            <input
              type="text"
              value={guide.description}
              maxLength={160}
              onChange={(e) => setGuide({ ...guide, description: e.target.value })}
            />
            <span style={{ fontSize: 11, color: "var(--ink-500)" }}>
              {guide.description.length} / 155 chars
            </span>
          </div>
          <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              value={guide.tags.join(", ")}
              onChange={(e) =>
                setGuide({
                  ...guide,
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
            <label>Intro paragraph <span style={{ fontWeight: 400, color: "var(--ink-500)" }}>(2–3 sentences shown below the title)</span></label>
            <textarea
              rows={3}
              value={guide.intro}
              onChange={(e) => setGuide({ ...guide, intro: e.target.value })}
            />
          </div>
          <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
            <label>Article body <span style={{ fontWeight: 400, color: "var(--ink-500)" }}>(Markdown — shown before the FAQs)</span></label>
            <textarea
              rows={16}
              value={guide.content}
              onChange={(e) => setGuide({ ...guide, content: e.target.value })}
              style={{ fontFamily: "monospace", fontSize: 13 }}
            />
          </div>
          <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
            <label>
              Cover image{" "}
              <span style={{ fontWeight: 400, color: "var(--ink-500)" }}>
                (optional — shown on detail page only)
              </span>
            </label>
            <div className={styles.uploadArea}>
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreview} alt="Cover preview" className={styles.thumbPreview} />
              ) : (
                <div className={styles.uploadPlaceholder}>
                  <span>🖼</span>
                  <span>No image selected</span>
                </div>
              )}
              <label className={styles.uploadLabel}>
                Choose image
                <input type="file" accept="image/*" onChange={onCoverFile} style={{ display: "none" }} />
              </label>
              <p className={styles.uploadHint}>
                PNG, JPG, WebP — recommended 1200×630px, max {formatFileSize(MAX_COVER_IMAGE_BYTES)}
              </p>
              {coverSizeError && <p className={styles.error}>{coverSizeError}</p>}
            </div>

            {/* AI-suggested thumbnail prompt — paste into an image generator,
                then upload the result above. */}
            <div
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 12,
                border: "1px dashed var(--sand-200, #e8e3db)",
                background: "var(--sand-50, #faf8f5)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-900)", margin: 0 }}>
                    Need a thumbnail idea?
                  </p>
                  <p style={{ fontSize: 12, color: "var(--ink-500)", margin: "2px 0 0" }}>
                    Generate an AI image-prompt from this guide, paste it into your image tool, then upload the result above.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value as ModelChoice)}
                    style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8 }}
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={handleSuggestThumbPrompt}
                    disabled={thumbPromptLoading || !guide.title}
                    title={!guide.title ? "Add a title first" : undefined}
                  >
                    {thumbPromptLoading ? (
                      <>
                        <span className={styles.spinner} />
                        Generating…
                      </>
                    ) : (
                      <>✨ Suggest thumbnail prompt</>
                    )}
                  </button>
                </div>
              </div>

              {thumbPromptError && (
                <p className={styles.error} style={{ marginTop: 10 }}>{thumbPromptError}</p>
              )}

              {thumbPrompt && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    readOnly
                    rows={4}
                    value={thumbPrompt}
                    style={{
                      width: "100%",
                      resize: "vertical",
                      fontSize: 13,
                      lineHeight: 1.5,
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--sand-200, #e8e3db)",
                      background: "#fff",
                      fontFamily: "inherit",
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <button type="button" className={styles.ghostBtn} onClick={copyThumbPrompt}>
                      {thumbPromptCopied ? "✓ Copied" : "Copy prompt"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.formCard}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontWeight: 700, fontSize: 15 }}>FAQs ({guide.faqs.length})</p>
          <button type="button" className={styles.ghostBtn} onClick={addFaq}>
            + Add FAQ
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {guide.faqs.map((faq, i) => (
            <div
              key={i}
              style={{
                border: "1px solid var(--sand-200)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: editingFaq === i ? "var(--sand-100)" : "#fafafa",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  fontFamily: "inherit",
                }}
                onClick={() => setEditingFaq(editingFaq === i ? null : i)}
              >
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                  {faq.question || (
                    <em style={{ color: "var(--ink-500)", fontStyle: "normal" }}>New question…</em>
                  )}
                </span>
                <span style={{ fontSize: 18, color: "var(--teal-500)", flexShrink: 0 }}>
                  {editingFaq === i ? "−" : "+"}
                </span>
              </button>
              {editingFaq === i && (
                <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className={styles.field}>
                    <label>Question</label>
                    <input
                      type="text"
                      value={faq.question}
                      onChange={(e) => updateFaq(i, "question", e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Answer</label>
                    <textarea
                      rows={4}
                      value={faq.answer}
                      onChange={(e) => updateFaq(i, "answer", e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.archiveBtn}
                    style={{
                      alignSelf: "flex-end",
                      fontSize: 12,
                      padding: "5px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(220,53,69,0.3)",
                      color: "#c0392b",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      removeFaq(i);
                      setEditingFaq(null);
                    }}
                  >
                    Remove FAQ
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.formActions}>
        {guide.status === "published" && (
          <a
            href={`/guide/${guide.slug}`}
            target="_blank"
            rel="noopener"
            className={styles.ghostBtn}
          >
            View live ↗
          </a>
        )}
        {guide.status !== "published" && (
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => handleSave("draft")}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save as draft"}
          </button>
        )}
        <button
          type="button"
          className={styles.enrichBtn}
          onClick={() => handleSave(guide.status === "published" ? guide.status : "published")}
          disabled={saving || !guide.title || !guide.slug}
        >
          {saving ? (
            <>
              <span className={styles.spinner} />
              Saving…
            </>
          ) : guide.status === "published" ? (
            "Save changes"
          ) : (
            "🚀 Publish guide"
          )}
        </button>
      </div>
    </div>
  );
}

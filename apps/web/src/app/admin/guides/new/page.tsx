"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../../admin.module.css";
import { MODEL_OPTIONS, type ModelChoice } from "@/lib/model-options";
import { MAX_COVER_IMAGE_BYTES, formatFileSize } from "@/lib/client-image";

type FAQ = { question: string; answer: string };

type RefinedGuide = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  intro: string;
  content: string;
  faqs: FAQ[];
  cover_image_url: string;
};

type EntryMode = "ai" | "manual";
type Step = "draft" | "review" | "done";

const CATEGORIES = ["Scholarships", "Applications", "Tests", "Destinations", "Visa"];

const BLANK_GUIDE: RefinedGuide = {
  slug: "",
  title: "",
  description: "",
  category: "Scholarships",
  tags: [],
  intro: "",
  content: "",
  faqs: [],
  cover_image_url: "",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export default function NewGuidePage() {
  const router = useRouter();
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [step, setStep] = useState<Step>("draft");

  // AI model picker
  const [aiModel, setAiModel] = useState<ModelChoice>("deepseek");

  // Step 1 (AI mode): draft
  const [draft, setDraft] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState("");

  // Step 2: review / edit
  const [guide, setGuide] = useState<RefinedGuide | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Author fields (both modes)
  const [writerName, setWriterName] = useState("");
  const [writerDesignation, setWriterDesignation] = useState("");
  const [authorDate, setAuthorDate] = useState("");

  // FAQ inline editing
  const [editingFaq, setEditingFaq] = useState<number | null>(null);

  // Cover image upload
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverSizeError, setCoverSizeError] = useState("");

  // AI-suggested thumbnail prompt
  const [thumbPrompt, setThumbPrompt] = useState("");
  const [thumbPromptLoading, setThumbPromptLoading] = useState(false);
  const [thumbPromptError, setThumbPromptError] = useState("");
  const [thumbPromptCopied, setThumbPromptCopied] = useState(false);

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

  const handleRefine = async () => {
    if (draft.trim().length < 30) {
      setRefineError("Please write at least a few sentences as a draft.");
      return;
    }
    setRefining(true);
    setRefineError("");
    try {
      const res = await fetch("/api/admin/guides/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, model: aiModel }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRefineError(json.error ?? "AI refinement failed.");
        return;
      }
      setGuide({ ...json.parsed as RefinedGuide, cover_image_url: "" });
      setStep("review");
    } catch (err) {
      setRefineError(String(err));
    } finally {
      setRefining(false);
    }
  };

  const startManual = () => {
    setGuide({ ...BLANK_GUIDE });
    setStep("review");
  };

  const handleSave = async (publish: boolean) => {
    if (!guide) return;
    // A thumbnail is mandatory to publish — it's used on the guide listing cards.
    if (publish && !coverFile) {
      setSaveError("A thumbnail / cover image is required to publish a guide.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      // Always created as a draft, even when the admin asked to publish: the
      // cover upload below needs the guide's id, and publishing is what fires
      // the push notification. Publishing in this same request — before a
      // cover exists — is how the very first push for a new guide always went
      // out without its thumbnail.
      const res = await fetch("/api/admin/guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...guide,
          cover_image_url: null,
          status: "draft",
          writer_name: writerName.trim() || null,
          writer_designation: writerDesignation.trim() || null,
          published_at: authorDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error ?? "Failed to save guide.");
        return;
      }

      const guideId = json.guide?.id as string | undefined;

      if (coverFile && guideId) {
        const fd = new FormData();
        fd.append("file", coverFile);
        const upRes = await fetch(`/api/admin/guides/${guideId}/cover`, {
          method: "POST",
          body: fd,
        });
        if (!upRes.ok) {
          const upJson = await upRes.json().catch(() => ({}));
          setSaveError(upJson.error ?? "Guide saved but cover upload failed.");
          return;
        }
      }

      if (publish && guideId) {
        // Re-send the author-chosen date: the PATCH route defaults
        // published_at to "now" whenever it's omitted, which would clobber
        // it otherwise.
        const pubRes = await fetch(`/api/admin/guides/${guideId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published", published_at: authorDate || undefined }),
        });
        if (!pubRes.ok) {
          const pubJson = await pubRes.json().catch(() => ({}));
          setSaveError(pubJson.error ?? "Guide and cover saved, but publishing failed.");
          return;
        }
      }

      setStep("done");
      if (publish) {
        setTimeout(() => router.push(`/guide/${guide.slug}`), 1200);
      } else {
        setTimeout(() => router.push("/admin/guides"), 1200);
      }
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setSaving(false);
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
    setGuide({
      ...guide,
      faqs: [...guide.faqs, { question: "", answer: "" }],
    });
    setEditingFaq(guide.faqs.length);
  };

  // ── Step: Done ──
  if (step === "done") {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <span style={{ fontSize: 48 }}>✅</span>
          <p style={{ fontSize: 18, fontWeight: 700 }}>Guide saved successfully!</p>
          <p style={{ color: "var(--ink-500)", fontSize: 14 }}>Redirecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin → Guides</p>
          <h1>New Guide</h1>
          <p className={styles.sub}>
            {entryMode === "manual"
              ? "Write your guide manually — content posted as-is, no AI refinement"
              : "Paste a draft — AI will structure it into an SEO-ready FAQ guide"}
          </p>
        </div>
        <Link href="/admin/guides" className={styles.ghostBtn}>
          ← Back
        </Link>
      </header>

      {/* Stepper */}
      <div className={styles.stepper}>
        <div className={`${styles.stepItem} ${step === "draft" ? styles.stepActive : styles.stepDone}`}>
          <span className={styles.stepDot}>{step !== "draft" ? "✓" : "1"}</span>
          {entryMode === "manual" ? "Write" : "Draft"}
        </div>
        <div className={`${styles.stepItem} ${(step as string) === "review" ? styles.stepActive : (step as string) === "done" ? styles.stepDone : ""}`}>
          <span className={styles.stepDot}>{(step as string) === "done" ? "✓" : "2"}</span>
          Review &amp; Edit
        </div>
        <div className={`${styles.stepItem} ${(step as string) === "done" ? styles.stepActive : ""}`}>
          <span className={styles.stepDot}>3</span>
          Publish
        </div>
      </div>

      {/* ── Step 1: Mode picker + Draft / Manual form ── */}
      {step === "draft" && (
        <div className={styles.formCard}>
          {/* Mode selector */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-700)", marginBottom: 10 }}>
              How do you want to add this guide?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setEntryMode("ai")}
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: `2px solid ${entryMode === "ai" ? "var(--teal-500, #0f8f8d)" : "var(--sand-200, #e8e3db)"}`,
                  background: entryMode === "ai" ? "var(--teal-50, #f0fafa)" : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>✨</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-900)" }}>AI-Assisted</div>
                <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
                  Paste a rough draft — AI structures it into a polished guide with FAQs
                </div>
              </button>
              <button
                type="button"
                onClick={() => setEntryMode("manual")}
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: `2px solid ${entryMode === "manual" ? "var(--teal-500, #0f8f8d)" : "var(--sand-200, #e8e3db)"}`,
                  background: entryMode === "manual" ? "var(--teal-50, #f0fafa)" : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>✏️</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-900)" }}>Manual Entry</div>
                <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
                  Write and post content as-is — no AI refinement
                </div>
              </button>
            </div>
          </div>

          {/* AI mode: draft textarea + model picker */}
          {entryMode === "ai" && (
            <>
              {/* AI model picker */}
              <div className={styles.aiControls}>
                <div className={styles.aiControlField}>
                  <label htmlFor="ai-model-guide">AI model</label>
                  <select
                    id="ai-model-guide"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value as ModelChoice)}
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.pasteSection}>
                <div className={styles.pasteLabelRow}>
                  <div>
                    <p className={styles.pasteLabel}>Your rough draft</p>
                    <p className={styles.pasteHint}>
                      Write notes, bullet points, or prose. The AI will expand it into 8–14 FAQs.
                      Include the topic, key questions students ask, and any specific facts you know.
                    </p>
                  </div>
                </div>
                <textarea
                  className={styles.pasteArea}
                  rows={16}
                  placeholder={`Example:\n\nTopic: Erasmus Mundus scholarships for Bangladeshi students\n\n- Fully funded by EU\n- For Masters degrees only (usually 1–2 years)\n- You must apply to a consortium of universities, not a single one\n- Stipend is around €1,000–€1,400/month depending on the consortium\n- No GRE required\n- IELTS 6.5 usually needed\n- Deadline is usually January for the following October intake\n- Very competitive — about 1% acceptance rate`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </div>

              {refineError && <p className={styles.error}>{refineError}</p>}

              <div className={styles.formActions}>
                <p className={styles.parsePrompt}>
                  {draft.length > 0
                    ? `${draft.length} chars — ready to refine`
                    : "Write your draft above, then click Refine"}
                </p>
                <button
                  type="button"
                  className={styles.parseBtn}
                  onClick={handleRefine}
                  disabled={refining || draft.trim().length < 30}
                >
                  {refining ? (
                    <>
                      <span className={styles.spinner} />
                      Refining…
                    </>
                  ) : (
                    <>✨ Refine with AI</>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Manual mode: proceed button */}
          {entryMode === "manual" && (
            <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
              <p style={{ fontSize: 13, color: "var(--ink-500)", marginBottom: 16 }}>
                You&apos;ll fill in the guide fields directly on the next screen. Add a thumbnail and optional author details.
              </p>
              <button
                type="button"
                className={styles.parseBtn}
                onClick={startManual}
              >
                Continue to form →
              </button>
            </div>
          )}

          {/* Nothing selected yet */}
          {!entryMode && (
            <p style={{ textAlign: "center", color: "var(--ink-400)", fontSize: 13, padding: "8px 0" }}>
              Select a mode above to get started
            </p>
          )}
        </div>
      )}

      {/* ── Step 2: Review & Edit ── */}
      {step === "review" && guide && (
        <>
          <div className={styles.formCard}>
            <div className={styles.parsedBadge}>
              {entryMode === "manual" ? "✏️ Manual entry — fill in your guide details" : "✨ AI-refined — review and edit before publishing"}
            </div>

            <div className={styles.fieldGrid}>
              <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                <label>Title</label>
                <input
                  type="text"
                  value={guide.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setGuide({
                      ...guide,
                      title,
                      slug: guide.slug || slugify(title),
                    });
                  }}
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
                    <option key={c} value={c}>{c}</option>
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
                      tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
              <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                <label>
                  Intro paragraph{" "}
                  <span style={{ fontWeight: 400, color: "var(--ink-500)" }}>(2–3 sentences shown below the title)</span>
                </label>
                <textarea
                  rows={3}
                  value={guide.intro}
                  onChange={(e) => setGuide({ ...guide, intro: e.target.value })}
                />
              </div>
              <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                <label>
                  Article body{" "}
                  <span style={{ fontWeight: 400, color: "var(--ink-500)" }}>(Markdown — shown before the FAQs)</span>
                </label>
                <textarea
                  rows={16}
                  value={guide.content}
                  onChange={(e) => setGuide({ ...guide, content: e.target.value })}
                  style={{ fontFamily: "monospace", fontSize: 13 }}
                />
              </div>

              {/* Thumbnail — required prompt in manual mode */}
              <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                <label>
                  Thumbnail / Cover image{" "}
                  <span style={{ fontWeight: 600, color: "var(--teal-600, #0a7070)" }}>
                    (required — shown on guide cards &amp; detail page)
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

              {/* Author / byline fields */}
              <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-700)", marginBottom: 10, display: "block" }}>
                  Author byline{" "}
                  <span style={{ fontWeight: 400, color: "var(--ink-500)" }}>(optional — displayed below the title)</span>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className={styles.field} style={{ margin: 0 }}>
                    <label>Writer name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahim Uddin"
                      value={writerName}
                      onChange={(e) => setWriterName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field} style={{ margin: 0 }}>
                    <label>Designation</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Counselor"
                      value={writerDesignation}
                      onChange={(e) => setWriterDesignation(e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.field} style={{ marginTop: 12, marginBottom: 0 }}>
                  <label>Publication date <span style={{ fontWeight: 400, color: "var(--ink-500)" }}>(optional — overrides auto-set date)</span></label>
                  <input
                    type="date"
                    value={authorDate}
                    onChange={(e) => setAuthorDate(e.target.value)}
                    style={{ maxWidth: 220 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* FAQ Editor */}
          <div className={styles.formCard}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontWeight: 700, fontSize: 15 }}>
                FAQs ({guide.faqs.length})
                {entryMode === "manual" && (
                  <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-500)", marginLeft: 8 }}>optional</span>
                )}
              </p>
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
                      {faq.question || <em style={{ color: "var(--ink-500)", fontStyle: "normal" }}>New question…</em>}
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
                        onClick={() => { removeFaq(i); setEditingFaq(null); }}
                      >
                        Remove FAQ
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {guide.faqs.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--ink-400)", textAlign: "center", padding: "12px 0" }}>
                  No FAQs yet — click &ldquo;+ Add FAQ&rdquo; to add one
                </p>
              )}
            </div>
          </div>

          {saveError && <p className={styles.error}>{saveError}</p>}

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => setStep("draft")}
              disabled={saving}
            >
              ← Back
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save as draft"}
            </button>
            <button
              type="button"
              className={styles.enrichBtn}
              onClick={() => handleSave(true)}
              disabled={saving || !guide.title || !guide.slug || !coverFile}
              title={!coverFile ? "Add a thumbnail / cover image to publish" : undefined}
            >
              {saving ? (
                <>
                  <span className={styles.spinner} />
                  Publishing…
                </>
              ) : (
                "🚀 Publish guide"
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

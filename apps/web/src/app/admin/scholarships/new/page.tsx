"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "../../admin.module.css";
import dupStyles from "./duplicate-check.module.css";

type SimilarMatch = {
  id: string;
  title: string;
  country: string;
  status: string;
  slug: string | null;
  similarity: number;
  match_type: "exact_url" | "likely" | "possible";
};

type Step = 1 | 2 | 3;
type Enriched = {
  eligibility_summary: string;
  competitiveness: string;
  tips: string;
  tags: string[];
  ai_summary: string;
  university_name: string;
};
type ParsedFields = {
  title: string;
  country: string;
  degree_level: string;
  funding_type: string;
  deadline: string;
  official_url: string;
  raw_description_english: string;
  confidence_note?: string;
  bangladeshi_eligible?: boolean;
  bangladeshi_eligibility_note?: string;
};

type ModelChoice = "deepseek" | "mistral" | "nim" | "kimi" | "gemini-flash";
const MODEL_OPTIONS: { value: ModelChoice; label: string }[] = [
  { value: "deepseek", label: "Deepseek V4 (best quality)" },
  { value: "mistral", label: "Mistral AI (fast, cheap)" },
  { value: "nim", label: "NVIDIA NIM (env model)" },
  { value: "kimi", label: "MiniMax M3 (NIM)" },
  { value: "gemini-flash", label: "Gemini 3.7 Flash (fast, cheap)" },
];

export default function NewScholarshipPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [rawInput, setRawInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedFields | null>(null);
  const [aiModel, setAiModel] = useState<ModelChoice>("deepseek");
  const [scrapeEnabled, setScrapeEnabled] = useState(true);
  const [parseMeta, setParseMeta] = useState<{
    modelUsed?: string;
    scrape?: { attempted: boolean; ok: boolean; url?: string; error?: string };
  } | null>(null);
  const [form, setForm] = useState({
    title: "", country: "", degree_level: "masters", funding_type: "full",
    deadline: "", official_url: "", raw_description: "",
    is_live: true, opening_note: "",
    bangladeshi_eligible: true as boolean | null,
    bangladeshi_eligibility_note: "",
  });
  // Admin has explicitly acknowledged the "not applicable for Bangladeshi
  // student" warning and wants to save anyway.
  const [bdOverride, setBdOverride] = useState(false);

  // Step 2 state
  const [scholarshipId, setScholarshipId] = useState<string | null>(null);
  const [enriched, setEnriched] = useState<Enriched | null>(null);
  const [enriching, setEnriching] = useState(false);

  // Step 3 state
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [_copied, _setCopied] = useState(false); // kept for future use

  // Duplicate check state
  const [similarMatches, setSimilarMatches] = useState<SimilarMatch[]>([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [dupDismissed, setDupDismissed] = useState(false);
  const dupCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const setBool = (k: string, v: boolean) => setForm((p) => ({ ...p, [k]: v }));

  // ── Duplicate / similarity check ──────────────────────────────────────────
  const checkSimilar = useCallback(
    async (title: string, country: string, officialUrl?: string) => {
      if (!title.trim()) return;
      setDupDismissed(false);
      setCheckingSimilar(true);
      try {
        const res = await fetch("/api/admin/scholarships/check-similar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, country, official_url: officialUrl ?? "" }),
        });
        if (res.ok) {
          const data = await res.json();
          setSimilarMatches(data.matches ?? []);
        }
      } catch {
        // silently ignore — this is a non-blocking helper
      } finally {
        setCheckingSimilar(false);
      }
    },
    []
  );

  // Debounced check triggered when user edits the title field manually
  const onTitleChange = (v: string) => {
    set("title", v);
    setSimilarMatches([]);
    if (dupCheckTimer.current) clearTimeout(dupCheckTimer.current);
    if (v.trim().length > 5) {
      dupCheckTimer.current = setTimeout(() => {
        checkSimilar(v, form.country, form.official_url);
      }, 800);
    }
  };

  // ── Parse raw text with AI ────────────────────────────────────────────────
  const parseWithAI = async () => {
    if (!rawInput.trim()) { setError("Please paste some scholarship text first."); return; }
    setError(null); setParsing(true); setParseMeta(null); setBdOverride(false);
    try {
      const res = await fetch("/api/admin/scholarships/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_description: rawInput, model: aiModel, scrape: scrapeEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");
      const p: ParsedFields = data.parsed;
      setParsed(p);
      setParseMeta(data.meta ?? null);
      setForm((prev) => ({
        ...prev,
        title: p.title ?? "",
        country: p.country ?? "",
        degree_level: p.degree_level ?? "masters",
        funding_type: p.funding_type ?? "full",
        deadline: p.deadline ?? "",
        official_url: p.official_url ?? "",
        raw_description: p.raw_description_english ?? rawInput,
        bangladeshi_eligible: p.bangladeshi_eligible ?? true,
        bangladeshi_eligibility_note: p.bangladeshi_eligibility_note ?? "",
      }));
      // Auto-check for duplicates after parsing
      if (p.title) {
        checkSimilar(p.title, p.country ?? "", p.official_url ?? "");
      }
    } catch (err) { setError(String(err)); }
    finally { setParsing(false); }
  };

  // ── Save draft ────────────────────────────────────────────────────────────
  const saveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const res = await fetch("/api/admin/scholarships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setScholarshipId(data.scholarship.id);
      setStep(2);
    } catch (err) { setError(String(err)); }
    finally { setLoading(false); }
  };

  // ── AI enrichment ─────────────────────────────────────────────────────────
  const enrich = async () => {
    if (!scholarshipId) return;
    setError(null); setEnriching(true);
    try {
      const res = await fetch(`/api/admin/scholarships/${scholarshipId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: aiModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Enrichment failed");
      setEnriched(data.enriched);
    } catch (err) { setError(String(err)); }
    finally { setEnriching(false); }
  };


  // ── Thumbnail + publish ───────────────────────────────────────────────────
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setThumbnailFile(f); setThumbnailPreview(URL.createObjectURL(f));
  };

  const publish = async (asDraft = false) => {
    if (!scholarshipId) return;
    setError(null); setLoading(true);
    try {
      const safeJson = async (res: Response) => {
        try {
          return await res.json();
        } catch {
          return null;
        }
      };
      if (thumbnailFile) {
        const fd = new FormData(); fd.append("file", thumbnailFile);
        const upRes = await fetch(`/api/admin/scholarships/${scholarshipId}/thumbnail`, { method: "POST", body: fd });
        if (!upRes.ok) {
          const d = await safeJson(upRes);
          throw new Error(d?.error ?? "Upload failed");
        }
      }
      if (!asDraft) {
        const ingestRes = await fetch(`/api/admin/scholarships/${scholarshipId}/ingest`, {
          method: "POST",
        });
        if (!ingestRes.ok) {
          const d = await safeJson(ingestRes);
          throw new Error(
            `Search indexing failed (thumbnail was saved). ${d?.error ?? "RAG ingest failed"}`
          );
        }
      }

      const pubRes = await fetch(`/api/admin/scholarships/${scholarshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: asDraft ? "draft" : "published" }),
      });
      if (!pubRes.ok) {
        const d = await safeJson(pubRes);
        throw new Error(d?.error ?? "Publish failed");
      }
      router.push("/admin/scholarships");
    } catch (err) { setError(String(err)); }
    finally { setLoading(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.kicker}>Admin · New Scholarship</p><h1>Add scholarship</h1></div>
      </header>

      {/* Stepper */}
      <div className={styles.stepper}>
        {["1. Paste & Parse", "2. AI Enrichment", "3. Thumbnail & Publish"].map((label, i) => (
          <div key={label} className={`${styles.stepItem} ${step > i + 1 ? styles.stepDone : ""} ${step === i + 1 ? styles.stepActive : ""}`}>
            <span className={styles.stepDot}>{step > i + 1 ? "✓" : i + 1}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {error && <p className={styles.error}>⚠ {error}</p>}

      {/* ── Step 1: Paste & AI Parse ── */}
      {step === 1 && (
        <form onSubmit={saveDraft} className={styles.formCard}>
          {/* Paste area */}
          <div className={styles.pasteSection}>
            <div className={styles.pasteLabelRow}>
              <div>
                <label className={styles.pasteLabel}>Paste scholarship info</label>
                <p className={styles.pasteHint}>
                  Paste as little as a name + country, or full details. If a link is
                  included, the AI will fetch the page and fill the rest. It also draws
                  on its knowledge of well-known scholarships.
                </p>
              </div>
              <button
                type="button"
                className={styles.parseBtn}
                onClick={parseWithAI}
                disabled={parsing || !rawInput.trim()}
              >
                {parsing
                  ? <><span className={styles.spinner} /> Working…</>
                  : "🤖 Parse + Scrape"}
              </button>
            </div>

            {/* AI controls */}
            <div className={styles.aiControls}>
              <div className={styles.aiControlField}>
                <label htmlFor="ai-model">AI model</label>
                <select
                  id="ai-model"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value as ModelChoice)}
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <label className={styles.scrapeToggle}>
                <input
                  type="checkbox"
                  checked={scrapeEnabled}
                  onChange={(e) => setScrapeEnabled(e.target.checked)}
                />
                Fetch official link if present
              </label>
            </div>

            <textarea
              rows={6}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={`Paste anything, for example:\n\nChevening Scholarship, UK\nFully funded. Tuition, monthly living allowance, return flight covered.\nOfficial link: https://chevening.org\n\n— or just —\n\nChevening Scholarship, UK`}
              className={styles.pasteArea}
            />

            {/* Parse result meta */}
            {parseMeta && (
              <div className={styles.parseMeta}>
                {parseMeta.scrape?.attempted && (
                  <span className={parseMeta.scrape.ok ? styles.scrapeOk : styles.scrapeFail}>
                    {parseMeta.scrape.ok
                      ? `✓ Fetched ${parseMeta.scrape.url}`
                      : `⚠ Couldn't fetch link (${parseMeta.scrape.error ?? "unknown"}) — used AI knowledge instead`}
                  </span>
                )}
                {parsed?.confidence_note && (
                  <span className={styles.confidenceNote}>ℹ {parsed.confidence_note}</span>
                )}
              </div>
            )}
          </div>

          {/* Parsed / editable fields */}
          {(parsed || rawInput) && (
            <div className={styles.parsedSection}>
              {parsed && (
                <div className={styles.parsedBadge}>
                  ✓ Fields auto-filled — review and edit if needed
                </div>
              )}

              {/* Bangladeshi-eligibility warning */}
              {parsed && form.bangladeshi_eligible === false && (
                <div className={dupStyles.dupPanel} data-severity="exact">
                  <div className={dupStyles.dupHeader}>
                    <span className={dupStyles.dupIcon}>🚫</span>
                    <div>
                      <strong className={dupStyles.dupTitle}>Not applicable for Bangladeshi students</strong>
                      <p className={dupStyles.dupSubtitle}>
                        {form.bangladeshi_eligibility_note || "This scholarship appears to exclude Bangladeshi nationals based on a nationality/citizenship restriction."}
                      </p>
                    </div>
                  </div>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--ink-700, #2c3e50)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={bdOverride}
                      onChange={(e) => setBdOverride(e.target.checked)}
                      style={{ marginTop: 2, accentColor: "#c0392b" }}
                    />
                    I&apos;ve verified this manually and want to add it anyway (e.g. the AI got it wrong)
                  </label>
                </div>
              )}
              {parsed && form.bangladeshi_eligible === true && form.bangladeshi_eligibility_note && (
                <div className={styles.confidenceNote}>
                  ✓ Open to Bangladeshi students — {form.bangladeshi_eligibility_note}
                </div>
              )}

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label>Title *</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder="e.g. Bond University Transformer Scholarship 2026"
                  />
                </div>
                <div className={styles.field}>
                  <label>Country *</label>
                  <input required value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="e.g. Australia" />
                </div>
                <div className={styles.field}>
                  <label>Degree level</label>
                  <select value={form.degree_level} onChange={(e) => set("degree_level", e.target.value)}>
                    <option value="bachelors">Bachelor&apos;s</option>
                    <option value="masters">Master&apos;s</option>
                    <option value="phd">PhD</option>
                    <option value="postdoc">Postdoc</option>
                    <option value="any">Any</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Funding type</label>
                  <select value={form.funding_type} onChange={(e) => set("funding_type", e.target.value)}>
                    <option value="full">Full funding</option>
                    <option value="partial">Partial</option>
                    <option value="tuition_only">Tuition only</option>
                    <option value="stipend">Stipend only</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                  <label>Application Status *</label>
                  <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 16px", borderRadius: 10, border: `2px solid ${form.is_live ? "var(--teal-500, #0f8f8d)" : "var(--sand-200, #e8e5dc)"}`, background: form.is_live ? "rgba(15, 143, 141, 0.06)" : "var(--sand-50, #faf9f6)", flex: 1, fontWeight: form.is_live ? 600 : 400, color: form.is_live ? "var(--teal-700)" : "var(--ink-600)", fontSize: 13 }}>
                      <input type="radio" name="is_live" value="live" checked={form.is_live} onChange={() => setBool("is_live", true)} style={{ accentColor: "var(--teal-500)" }} />
                      Open Now — applications currently live
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 16px", borderRadius: 10, border: `2px solid ${!form.is_live ? "var(--amber-400, #f59e0b)" : "var(--sand-200, #e8e5dc)"}`, background: !form.is_live ? "rgba(245, 158, 11, 0.06)" : "var(--sand-50, #faf9f6)", flex: 1, fontWeight: !form.is_live ? 600 : 400, color: !form.is_live ? "var(--amber-700, #b45309)" : "var(--ink-600)", fontSize: 13 }}>
                      <input type="radio" name="is_live" value="upcoming" checked={!form.is_live} onChange={() => setBool("is_live", false)} style={{ accentColor: "var(--amber-400)" }} />
                      Opening Soon — not yet accepting applications
                    </label>
                  </div>
                </div>
                <div className={styles.field}>
                  <label>{form.is_live ? "Deadline *" : "Deadline (optional)"}</label>
                  <input
                    type="text"
                    value={form.deadline}
                    onChange={(e) => set("deadline", e.target.value)}
                    placeholder={form.is_live ? "e.g. 31 Dec 2026" : "Leave blank if unknown"}
                    required={form.is_live}
                  />
                </div>
                {!form.is_live && (
                  <div className={styles.field}>
                    <label>Typically opens when (optional)</label>
                    <input
                      type="text"
                      value={form.opening_note}
                      onChange={(e) => set("opening_note", e.target.value)}
                      placeholder="e.g. August–October each year, Early 2027"
                    />
                  </div>
                )}
                <div className={styles.field}>
                  <label>Official URL</label>
                  <input type="url" value={form.official_url} onChange={(e) => set("official_url", e.target.value)} placeholder="https://…" />
                </div>
              </div>
              <div className={styles.field}>
                <label>Description (English)</label>
                <textarea rows={5} value={form.raw_description} onChange={(e) => set("raw_description", e.target.value)} />
              </div>
            </div>
          )}

          {/* Similarity warning */}
          {(checkingSimilar || (similarMatches.length > 0 && !dupDismissed)) && (
            <div className={dupStyles.dupPanel} data-severity={
              similarMatches.some(m => m.match_type === "exact_url") ? "exact" :
              similarMatches.some(m => m.match_type === "likely") ? "likely" : "possible"
            }>
              {checkingSimilar ? (
                <div className={dupStyles.dupChecking}>
                  <span className={styles.spinner} /> Checking for similar scholarships…
                </div>
              ) : (
                <>
                  <div className={dupStyles.dupHeader}>
                    <span className={dupStyles.dupIcon}>
                      {similarMatches.some(m => m.match_type === "exact_url") ? "🔴" :
                       similarMatches.some(m => m.match_type === "likely") ? "⚠️" : "💡"}
                    </span>
                    <div>
                      <strong className={dupStyles.dupTitle}>
                        {similarMatches.some(m => m.match_type === "exact_url")
                          ? "This scholarship already exists"
                          : similarMatches.some(m => m.match_type === "likely")
                          ? "Possible duplicate detected"
                          : "Similar scholarships found"}
                      </strong>
                      <p className={dupStyles.dupSubtitle}>
                        {similarMatches.some(m => m.match_type === "exact_url")
                          ? "A scholarship with the same official URL is already in the database."
                          : "The following scholarships look similar. Check if one of them is the same before adding a new one."}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={dupStyles.dupDismiss}
                      onClick={() => setDupDismissed(true)}
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                  <ul className={dupStyles.dupList}>
                    {similarMatches.map((m) => (
                      <li key={m.id} className={dupStyles.dupItem} data-type={m.match_type}>
                        <div className={dupStyles.dupItemInfo}>
                          <span className={dupStyles.dupItemBadge} data-type={m.match_type}>
                            {m.match_type === "exact_url" ? "Exact URL match" :
                             m.match_type === "likely" ? `${Math.round(m.similarity * 100)}% match` :
                             `${Math.round(m.similarity * 100)}% similar`}
                          </span>
                          <span className={dupStyles.dupItemTitle}>{m.title}</span>
                          <span className={dupStyles.dupItemCountry}>{m.country}</span>
                          <span className={dupStyles.dupItemStatus} data-status={m.status}>{m.status}</span>
                        </div>
                        <a
                          href={`/admin/scholarships/${m.id}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={dupStyles.dupViewBtn}
                        >
                          View →
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className={dupStyles.dupFooter}>
                    Not a duplicate?{" "}
                    <button type="button" className={dupStyles.dupProceedLink} onClick={() => setDupDismissed(true)}>
                      Proceed anyway
                    </button>
                  </p>
                </>
              )}
            </div>
          )}

          <div className={styles.formActions}>
            {!parsed && !form.title && (
              <p className={styles.parsePrompt}>← Paste text above and click <strong>Parse with AI</strong> to auto-fill fields, or fill them manually.</p>
            )}
            {form.bangladeshi_eligible === false && !bdOverride && (
              <p className={styles.parsePrompt} style={{ color: "#c0392b" }}>
                Not applicable for Bangladeshi students — tick the box above to save anyway.
              </p>
            )}
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={loading || !form.title || !form.country || (form.bangladeshi_eligible === false && !bdOverride)}
            >
              {loading ? "Saving…" : "Save & continue →"}
            </button>
          </div>
        </form>
      )}

      {/* ── Step 2: AI Enrichment ── */}
      {step === 2 && (
        <div className={styles.formCard}>
          <p className={styles.sub}>
            Using <strong>{MODEL_OPTIONS.find((m) => m.value === aiModel)?.label}</strong>.
            Click <strong>Enrich with AI</strong> to auto-fill eligibility, tips, tags,
            summary, and generate a thumbnail image prompt.
          </p>
          <div className={styles.verifyWarning}>
            ⚠ AI-generated content can be inaccurate. Review every field — especially
            deadlines and eligibility — before publishing.
          </div>
          {!enriched ? (
            <button className={styles.enrichBtn} onClick={enrich} disabled={enriching}>
              {enriching ? <><span className={styles.spinner} /> Enriching with AI…</> : "✨ Enrich with AI"}
            </button>
          ) : (
            <div className={styles.enrichedResult}>
              <div className={styles.enrichedField}><span className={styles.enrichedLabel}>Eligibility</span><p>{enriched.eligibility_summary}</p></div>
              <div className={styles.enrichedField}>
                <span className={styles.enrichedLabel}>Competitiveness</span>
                <span className={`${styles.badge} ${styles[`badge_comp_${enriched.competitiveness?.toLowerCase()}`]}`}>{enriched.competitiveness}</span>
              </div>
              <div className={styles.enrichedField}><span className={styles.enrichedLabel}>Tips</span><p style={{ whiteSpace: "pre-line" }}>{enriched.tips}</p></div>
              <div className={styles.enrichedField}><span className={styles.enrichedLabel}>Tags</span><div className={styles.tagRow}>{enriched.tags?.map((t) => <span key={t} className={styles.tag}>{t}</span>)}</div></div>
              <div className={styles.enrichedField}><span className={styles.enrichedLabel}>AI Summary</span><p>{enriched.ai_summary}</p></div>
              <div className={styles.thumbnailPromptBox}>
                <div className={styles.thumbnailPromptHeader}>
                  <span className={styles.enrichedLabel}>🏛 University / Institution</span>
                </div>
                <p className={styles.promptText} style={{ fontWeight: 600, fontSize: 15 }}>{enriched.university_name}</p>
                <p className={styles.promptHint}>Search for this university&apos;s image online and upload it as the thumbnail in the next step.</p>
              </div>
            </div>
          )}
          <div className={styles.formActions}>
            <button className={styles.ghostBtn} onClick={() => setStep(1)} disabled={enriching}>← Back</button>
            <button className={styles.primaryBtn} onClick={() => setStep(3)} disabled={enriching || !enriched}>Continue →</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Thumbnail + Publish ── */}
      {step === 3 && (
        <div className={styles.formCard}>
          <p className={styles.sub}>Upload the thumbnail you generated, then publish.</p>
          <div className={styles.uploadArea}>
            {thumbnailPreview
              ? <img src={thumbnailPreview} alt="Thumbnail preview" className={styles.thumbPreview} />
              : <div className={styles.uploadPlaceholder}><span>🖼</span><span>No image selected</span></div>}
            <label className={styles.uploadLabel}>
              Choose image
              <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
            </label>
            <p className={styles.uploadHint}>PNG, JPG, WebP — recommended 1200×630px</p>
          </div>
          <div className={styles.formActions}>
            <button className={styles.ghostBtn} onClick={() => setStep(2)} disabled={loading}>← Back</button>
            <button className={styles.ghostBtn} onClick={() => publish(true)} disabled={loading}>Save as draft</button>
            <button className={styles.primaryBtn} onClick={() => publish(false)} disabled={loading}>{loading ? "Publishing…" : "🚀 Publish"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import styles from "../../../admin.module.css";

export default function EditScholarshipPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [form, setForm] = useState({
    title: "", country: "", degree_level: "masters", funding_type: "full",
    deadline: "", official_url: "", raw_description: "",
    eligibility_summary: "", tips: "", ai_summary: "", competitiveness: "", tags: "",
    is_flagship: false as boolean,
    is_live: true as boolean,
    opening_note: "",
    bangladeshi_eligible: true as boolean,
    bangladeshi_eligibility_note: "",
  });

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [originalThumbnail, setOriginalThumbnail] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/scholarships/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else if (data.scholarship) {
          const s = data.scholarship;
          setForm({
            title: s.title ?? "",
            country: s.country ?? "",
            degree_level: s.degree_level ?? "masters",
            funding_type: s.funding_type ?? "full",
            deadline: s.deadline ?? "",
            official_url: s.official_url ?? "",
            raw_description: s.raw_description ?? "",
            eligibility_summary: s.eligibility_summary ?? "",
            tips: s.tips ?? "",
            ai_summary: s.ai_summary ?? "",
            competitiveness: s.competitiveness ?? "",
            tags: (s.tags ?? []).join(", "),
            is_flagship: s.is_flagship ?? false,
            is_live: s.is_live ?? true,
            opening_note: s.opening_note ?? "",
            bangladeshi_eligible: s.bangladeshi_eligible ?? true,
            bangladeshi_eligibility_note: s.bangladeshi_eligibility_note ?? "",
          });
          setOriginalThumbnail(s.thumbnail_url);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(String(err));
        setLoading(false);
      });
  }, [id]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const setBool = (k: string, v: boolean) => setForm((p) => ({ ...p, [k]: v }));

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; 
    if (!f) return;
    setThumbnailFile(f); 
    setThumbnailPreview(URL.createObjectURL(f));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); 
    setSaving(true);
    try {
      const safeJson = async (res: Response) => {
        try {
          return await res.json();
        } catch {
          return null;
        }
      };

      // 1. Update text fields
      const dataToSave = { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) };
      const patchRes = await fetch(`/api/admin/scholarships/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave),
      });
      if (!patchRes.ok) {
        const d = await safeJson(patchRes);
        throw new Error(d?.error ?? "Failed to save fields");
      }

      // 2. Upload thumbnail if changed
      if (thumbnailFile) {
        const fd = new FormData(); 
        fd.append("file", thumbnailFile);
        const upRes = await fetch(`/api/admin/scholarships/${id}/thumbnail`, { method: "POST", body: fd });
        if (!upRes.ok) {
          const d = await safeJson(upRes);
          throw new Error(d?.error ?? "Upload failed");
        }
      }

      // 3. Re-ingest RAG embeddings since data might have changed
      const ingestRes = await fetch(`/api/admin/scholarships/${id}/ingest`, { method: "POST" });
      if (!ingestRes.ok) {
         console.warn("RAG ingest failed, but fields were saved");
      }

      router.refresh();
      router.push("/admin/scholarships");
    } catch (err) { 
      setError(String(err)); 
    } finally { 
      setSaving(false); 
    }
  };

  if (loading) {
    return <div className={styles.page}><p>Loading...</p></div>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.kicker}>Admin · Edit Scholarship</p><h1>Edit scholarship</h1></div>
      </header>

      {error && <p className={styles.error}>⚠ {error}</p>}

      <form onSubmit={save} className={styles.formCard}>
        {/* Flagship toggle – shown at the very top for easy access */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "12px 16px", background: form.is_flagship ? "var(--amber-50, #fffbeb)" : "var(--sand-100, #f5f4f0)", border: `1.5px solid ${form.is_flagship ? "var(--amber-300, #fcd34d)" : "var(--sand-200, #e8e5dc)"}`, borderRadius: 10 }}>
          <input
            type="checkbox"
            id="is_flagship"
            checked={form.is_flagship}
            onChange={(e) => setBool("is_flagship", e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--amber-500, #f59e0b)", cursor: "pointer", flexShrink: 0 }}
          />
          <label htmlFor="is_flagship" style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, color: form.is_flagship ? "var(--amber-700, #b45309)" : "var(--ink-700)" }}>
            ⭐ Mark as Flagship (pinned to top of public list)
          </label>
        </div>

        {/* Bangladeshi eligibility toggle */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, padding: "12px 16px", background: !form.bangladeshi_eligible ? "#fff1f1" : "var(--sand-100, #f5f4f0)", border: `1.5px solid ${!form.bangladeshi_eligible ? "#f87171" : "var(--sand-200, #e8e5dc)"}`, borderRadius: 10 }}>
          <input
            type="checkbox"
            id="bd_eligible"
            checked={form.bangladeshi_eligible}
            onChange={(e) => setBool("bangladeshi_eligible", e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "#0f8f8d", cursor: "pointer", flexShrink: 0, marginTop: 2 }}
          />
          <div>
            <label htmlFor="bd_eligible" style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, color: !form.bangladeshi_eligible ? "#b91c1c" : "var(--ink-700)", display: "block" }}>
              🇧🇩 Bangladeshi students can apply
            </label>
            {!form.bangladeshi_eligible && (
              <p style={{ fontSize: 12.5, color: "#b91c1c", margin: "4px 0 0" }}>
                Unchecked — this scholarship is marked as not applicable for Bangladeshi students.
              </p>
            )}
          </div>
        </div>
        <div className={styles.field} style={{ marginBottom: 24 }}>
          <label>Eligibility note (why / why not applicable for Bangladeshi students)</label>
          <input
            type="text"
            value={form.bangladeshi_eligibility_note}
            onChange={(e) => set("bangladeshi_eligibility_note", e.target.value)}
            placeholder="e.g. Restricted to EU/EEA citizens; Bangladesh not included."
          />
        </div>

        {/* Application status selector */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-700)", marginBottom: 8 }}>Application Status *</p>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 16px", borderRadius: 10, border: `2px solid ${form.is_live ? "var(--teal-500, #0f8f8d)" : "var(--sand-200, #e8e5dc)"}`, background: form.is_live ? "rgba(15, 143, 141, 0.06)" : "var(--sand-50, #faf9f6)", flex: 1, fontWeight: form.is_live ? 600 : 400, color: form.is_live ? "var(--teal-700)" : "var(--ink-600)", fontSize: 13 }}>
              <input type="radio" name="edit_is_live" value="live" checked={form.is_live} onChange={() => setBool("is_live", true)} style={{ accentColor: "var(--teal-500)" }} />
              Open Now — applications currently live
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 16px", borderRadius: 10, border: `2px solid ${!form.is_live ? "var(--amber-400, #f59e0b)" : "var(--sand-200, #e8e5dc)"}`, background: !form.is_live ? "rgba(245, 158, 11, 0.06)" : "var(--sand-50, #faf9f6)", flex: 1, fontWeight: !form.is_live ? 600 : 400, color: !form.is_live ? "var(--amber-700, #b45309)" : "var(--ink-600)", fontSize: 13 }}>
              <input type="radio" name="edit_is_live" value="upcoming" checked={!form.is_live} onChange={() => setBool("is_live", false)} style={{ accentColor: "var(--amber-400)" }} />
              Opening Soon — not yet accepting applications
            </label>
          </div>
        </div>

        <div className={styles.parsedSection} style={{ marginTop: 0 }}>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label>Title *</label>
              <input required value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Country *</label>
              <input required value={form.country} onChange={(e) => set("country", e.target.value)} />
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
            <div className={styles.field}>
              <label>{form.is_live ? "Deadline" : "Deadline (optional)"}</label>
              <input type="text" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} placeholder={form.is_live ? "e.g. 31 Dec 2026" : "Leave blank if unknown"} />
            </div>
            {!form.is_live && (
              <div className={styles.field}>
                <label>Typically opens when (optional)</label>
                <input type="text" value={form.opening_note} onChange={(e) => set("opening_note", e.target.value)} placeholder="e.g. August–October each year, Early 2027" />
              </div>
            )}
            <div className={styles.field}>
              <label>Official URL</label>
              <input type="url" value={form.official_url} onChange={(e) => set("official_url", e.target.value)} />
            </div>
          </div>
          <div className={styles.field} style={{ marginTop: 24 }}>
            <label>Description (English)</label>
            <textarea rows={5} value={form.raw_description} onChange={(e) => set("raw_description", e.target.value)} />
          </div>
          
          <div style={{ marginTop: 32 }}>
            <h3 className={styles.sub}>AI Extracted Fields</h3>
            <div className={styles.fieldGrid} style={{ marginTop: 16 }}>
              <div className={styles.field}>
                <label>Competitiveness</label>
                <input value={form.competitiveness} onChange={(e) => set("competitiveness", e.target.value)} placeholder="e.g. High, Medium, Low" />
              </div>
              <div className={styles.field}>
                <label>Tags (comma separated)</label>
                <input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="e.g. STEM, Women, Need-based" />
              </div>
            </div>
            <div className={styles.field} style={{ marginTop: 16 }}>
              <label>AI Summary</label>
              <textarea rows={3} value={form.ai_summary} onChange={(e) => set("ai_summary", e.target.value)} />
            </div>
            <div className={styles.field} style={{ marginTop: 16 }}>
              <label>Eligibility Summary</label>
              <textarea rows={3} value={form.eligibility_summary} onChange={(e) => set("eligibility_summary", e.target.value)} />
            </div>
            <div className={styles.field} style={{ marginTop: 16 }}>
              <label>Tips</label>
              <textarea rows={3} value={form.tips} onChange={(e) => set("tips", e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32 }}>
          <p className={styles.sub}>Thumbnail</p>
          <div className={styles.uploadArea}>
            {thumbnailPreview ? (
              <img src={thumbnailPreview} alt="New thumbnail preview" className={styles.thumbPreview} />
            ) : originalThumbnail ? (
              <img src={originalThumbnail} alt="Current thumbnail" className={styles.thumbPreview} />
            ) : (
              <div className={styles.uploadPlaceholder}><span>🖼</span><span>No image</span></div>
            )}
            <label className={styles.uploadLabel}>
              Choose new image
              <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
            </label>
            <p className={styles.uploadHint}>PNG, JPG, WebP — recommended 1200×630px</p>
          </div>
        </div>

        <div className={styles.formActions} style={{ marginTop: 32 }}>
          <button type="button" className={styles.ghostBtn} onClick={() => router.push("/admin/scholarships")} disabled={saving}>Cancel</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving || !form.title || !form.country}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

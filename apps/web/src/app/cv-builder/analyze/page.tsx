"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/auth/auth-guard";
import NavbarWithAuth from "@/components/layout/navbar-with-auth";
import type { CVAnalysis, SectionFeedback } from "@/lib/cv-analyze";
import styles from "./analyze.module.css";

const RATING_LABEL: Record<SectionFeedback["rating"], string> = {
  strong: "Strong",
  adequate: "Adequate",
  "needs-work": "Needs work",
  missing: "Missing",
};

/* ── Stage definitions for the "in-flight" progress panel ──
 * The backend is a single request, but we want the user to *feel* something
 * happening. Each stage gets a minimum dwell time so the animation feels
 * intentional (not jittery) and matches typical AI-pipeline steps. Total
 * budget is the longest reasonable wait (~50s). Stages past the minimum cap
 * move forward the moment the request returns. */
type Stage = {
  id: string;
  label: string;
  hint: string;
  minMs: number;
};

const STAGES: Stage[] = [
  { id: "read",       label: "Reading your CV",       hint: "Extracting text from the file…",                      minMs: 2500 },
  { id: "detect",     label: "Detecting sections",    hint: "Education, research, awards, publications…",         minMs: 3500 },
  { id: "structure",  label: "Evaluating structure",  hint: "Layout, length, and how admissions committees read.", minMs: 4500 },
  { id: "strengths",  label: "Finding strengths",     hint: "What's already working in your favour.",               minMs: 4000 },
  { id: "gaps",       label: "Spotting gaps",         hint: "Missing sections and weak spots.",                     minMs: 4500 },
  { id: "review",     label: "Reviewing section by section", hint: "Concrete suggestions for each block.",          minMs: 5000 },
  { id: "finalize",   label: "Finalizing your report", hint: "Putting it all together with a clear action plan.",   minMs: 3000 },
];

const STAGE_CAP_MS = 26_000; // past this we don't dwell further

/* ── Icon components (inline SVG so no extra deps) ── */
function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16V4m0 0-4 4m4-4 4 4M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 13.6 8.4 18.5 10 13.6 11.6 12 16.5 10.4 11.6 5.5 10l4.9-1.6L12 3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 8V6.5A1.5 1.5 0 0 1 6.5 5H8M19 8V6.5A1.5 1.5 0 0 0 17.5 5H16M5 16v1.5A1.5 1.5 0 0 0 6.5 19H8M19 16v1.5A1.5 1.5 0 0 1 17.5 19H16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M4 11h16M4 13h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5v15l-7-2.5-7 2.5v-15Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function FileTextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3.5h7.379a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 19 8.122V18a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18V5.5A2 2 0 0 1 7 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.5 12h7M8.5 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlatformIllustration() {
  return (
    <svg viewBox="0 0 320 200" role="presentation" aria-hidden="true" className={styles.heroIllustration}>
      <defs>
        <linearGradient id="bg-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
        </linearGradient>
      </defs>
      <rect x="48" y="22" width="172" height="160" rx="10" fill="url(#bg-g)" />
      <rect x="48" y="22" width="172" height="160" rx="10" fill="none" stroke="#e8e3db" />
      <circle cx="62" cy="38" r="7" fill="#0c7b79" />
      <rect x="76" y="34" width="100" height="6" rx="3" fill="#0c7b79" />
      <rect x="76" y="44" width="60" height="3" rx="1.5" fill="#d4cfc7" />

      <rect x="62" y="68" width="80" height="5" rx="2.5" fill="#0c7b79" />
      <rect x="62" y="80" width="140" height="3" rx="1.5" fill="#d4cfc7" />
      <rect x="62" y="88" width="130" height="3" rx="1.5" fill="#d4cfc7" />
      <rect x="62" y="96" width="100" height="3" rx="1.5" fill="#d4cfc7" />

      <rect x="62" y="114" width="60" height="5" rx="2.5" fill="#0c7b79" />
      <rect x="62" y="126" width="140" height="3" rx="1.5" fill="#d4cfc7" />
      <rect x="62" y="134" width="120" height="3" rx="1.5" fill="#d4cfc7" />

      {/* magnifying glass */}
      <circle cx="240" cy="120" r="42" fill="#ffffff" stroke="#f08a68" strokeWidth="3" />
      <rect x="268" y="148" width="32" height="8" rx="4" transform="rotate(45 268 148)" fill="#f08a68" />
      <circle cx="240" cy="120" r="28" fill="none" stroke="#0f8f8d" strokeWidth="1.5" strokeDasharray="3 4" />
      <path d="M228 116h24M228 124h16" stroke="#0f8f8d" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function CVAnalyzePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<CVAnalysis | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [creatingCV, setCreatingCV] = useState(false);

  // ── "Drag" state for the dropzone (visual feedback) ──
  const [dragOver, setDragOver] = useState(false);

  // ── Stage / progress state ──
  const [activeStage, setActiveStage] = useState(0);
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = useState(0); // seconds since analysis started

  // Load the most recent analysis so returning users see their last result.
  useEffect(() => {
    fetch("/api/cv/analyze")
      .then((res) => res.json())
      .then((data) => {
        if (data.analysis?.result) {
          setAnalysis(data.analysis.result as CVAnalysis);
          setSourceName(data.analysis.source_name || "");
          setStatus("done");
        }
      })
      .catch(() => {});
  }, []);

  /* ── Drive stages forward in step with min-dwell times ── */
  useEffect(() => {
    if (status !== "loading") return;

    const startedAt = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    let stage = 0;
    let elapsedTimer: ReturnType<typeof setInterval> | null = null;

    const advance = () => {
      // Capture the id by value now — setCompletedStages's updater runs
      // slightly later, and `stage` is mutated right below. Reading
      // `STAGES[stage]` from inside the updater would race with that
      // mutation and, on the final stage, read past the end of the array.
      const finishedStageId = STAGES[stage].id;
      setCompletedStages((prev) => {
        const next = new Set(prev);
        next.add(finishedStageId);
        return next;
      });
      stage += 1;
      if (stage < STAGES.length) {
        setActiveStage(stage);
        const dwell = Math.min(STAGES[stage].minMs, STAGE_CAP_MS - (Date.now() - startedAt));
        timers.push(setTimeout(advance, Math.max(800, dwell)));
      }
    };

    // First stage starts after a brief tick (so the user sees "Reading").
    timers.push(setTimeout(advance, Math.max(800, STAGES[0].minMs)));

    elapsedTimer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);

    return () => {
      timers.forEach(clearTimeout);
      if (elapsedTimer) clearInterval(elapsedTimer);
    };
  }, [status]);

  const finishWithSuccess = (data: { analysis: CVAnalysis; sourceName?: string }) => {
    // Mark every stage done and freeze timer.
    setCompletedStages(new Set(STAGES.map((s) => s.id)));
    setActiveStage(STAGES.length - 1);
    setAnalysis(data.analysis);
    setSourceName(data.sourceName || "");
    setStatus("done");
  };

  const runAnalysis = async () => {
    // Reset progress before kicking off the effect-driven progression.
    setActiveStage(0);
    setCompletedStages(new Set());
    setElapsed(0);
    setStatus("loading");
    setError("");
    try {
      let res: Response;
      if (mode === "upload") {
        if (!file) {
          setError("Please choose a file first.");
          setStatus("error");
          return;
        }
        const fd = new FormData();
        fd.append("file", file);
        res = await fetch("/api/cv/analyze", { method: "POST", body: fd });
      } else {
        if (pastedText.trim().length < 80) {
          setError("Please paste at least a few lines of your CV.");
          setStatus("error");
          return;
        }
        res = await fetch("/api/cv/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pastedText }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Analysis failed. Please try again.");
        setStatus("error");
        return;
      }
      finishWithSuccess({
        analysis: data.analysis as CVAnalysis,
        sourceName: data.sourceName || "",
      });
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  const buildFromScratch = async () => {
    setCreatingCV(true);
    try {
      const res = await fetch("/api/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "classic", title: "My Academic CV" }),
      });
      const data = await res.json();
      if (res.ok && data.cv?.id) {
        router.push(`/cv-builder/${data.cv.id}`);
        return;
      }
    } catch {
      // fall through
    }
    setCreatingCV(false);
    router.push("/cv-builder");
  };

  const scoreTone = analysis
    ? analysis.overallScore >= 75
      ? "high"
      : analysis.overallScore >= 50
        ? "mid"
        : "low"
    : "mid";

  const progressPct =
    status === "done"
      ? 100
      : Math.min(
          100,
          Math.round(
            ((completedStages.size + (activeStage > completedStages.size ? 0.5 : 0)) /
              STAGES.length) *
              100
          )
        );

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <AuthGuard>
      <div className={styles.page}>
        <NavbarWithAuth />

        <main className={styles.main}>
          <Link href="/cv-builder" className={styles.back}>
            ← Back to CV Builder
          </Link>

          {/* ── Hero ── */}
          <header className={styles.hero}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>
                <SparkleIcon /> CV Analyzer
              </span>
              <h1>
                Find out what your CV is <span className={styles.heroAccent}>really</span> saying.
              </h1>
              <p className={styles.subtitle}>
                Upload your existing CV and our advanced AI models will score it,
                surface strengths and gaps, and give you a section-by-section
                action plan — so your next CV opens doors.
              </p>
              <ul className={styles.heroBadges}>
                <li><span className={styles.heroBadgeDot} data-color="teal" />Free, no signup</li>
                <li><span className={styles.heroBadgeDot} data-color="coral" />~30 second analysis</li>
                <li><span className={styles.heroBadgeDot} data-color="sand" />Private &amp; deletable</li>
              </ul>
            </div>
            <div className={styles.heroVisual} aria-hidden="true">
              <PlatformIllustration />
            </div>
          </header>

          {/* ── Input card ── */}
          {(status === "idle" || status === "error") && (
            <section className={styles.inputCard}>
              <div className={styles.tabs} role="tablist">
                <button
                  role="tab"
                  aria-selected={mode === "upload"}
                  className={mode === "upload" ? styles.tabActive : styles.tab}
                  onClick={() => setMode("upload")}
                >
                  Upload file
                </button>
                <button
                  role="tab"
                  aria-selected={mode === "paste"}
                  className={mode === "paste" ? styles.tabActive : styles.tab}
                  onClick={() => setMode("paste")}
                >
                  Paste text
                </button>
              </div>

              {mode === "upload" ? (
                <button
                  type="button"
                  className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  data-has-file={Boolean(file)}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    hidden
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setDragOver(false);
                    }}
                  />
                  <span className={styles.dropIcon} aria-hidden="true">
                    {file ? <FileTextIcon /> : <UploadIcon />}
                  </span>
                  <span className={styles.dropText}>
                    {file ? file.name : "Click or drag a CV to upload"}
                  </span>
                  <span className={styles.dropHint}>
                    {file
                      ? `${(file.size / 1024).toFixed(0)} KB · ready to analyze`
                      : "PDF, DOCX, or TXT · up to 8 MB"}
                  </span>
                  {file && (
                    <span
                      className={styles.dropClear}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setFile(null);
                        }
                      }}
                    >
                      Remove
                    </span>
                  )}
                </button>
              ) : (
                <textarea
                  className={styles.textarea}
                  placeholder="Paste the full text of your CV here…"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={10}
                />
              )}

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <button
                type="button"
                className={styles.analyzeBtn}
                onClick={runAnalysis}
              >
                <SparkleIcon />
                Analyze my CV
              </button>
            </section>
          )}

          {/* ── In-flight progress panel ── */}
          {status === "loading" && (
            <section className={styles.progressCard} aria-live="polite">
              <div className={styles.progressHeader}>
                <div>
                  <span className={styles.progressEyebrow}>Analyzing</span>
                  <h2 className={styles.progressTitle}>
                    {STAGES[activeStage].label}
                  </h2>
                  <p className={styles.progressHint}>
                    {STAGES[activeStage].hint}
                  </p>
                </div>
                <div className={styles.progressTimer}>
                  <span className={styles.progressTimerValue}>
                    {formatElapsed(elapsed)}
                  </span>
                  <span className={styles.progressTimerLabel}>elapsed</span>
                </div>
              </div>

              <div className={styles.progressBarWrap}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <ol className={styles.stageList}>
                {STAGES.map((stage, i) => {
                  const done = completedStages.has(stage.id);
                  const active = i === activeStage && !done;
                  const pending = i > activeStage;
                  return (
                    <li
                      key={stage.id}
                      className={[
                        styles.stage,
                        done ? styles.stageDone : "",
                        active ? styles.stageActive : "",
                        pending ? styles.stagePending : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span className={styles.stageBadge} aria-hidden="true">
                        {done ? <CheckIcon /> : i + 1}
                      </span>
                      <span className={styles.stageText}>
                        <strong>{stage.label}</strong>
                        <span className={styles.stageHint}>{stage.hint}</span>
                      </span>
                      {active && (
                        <span className={styles.stageSpinner} aria-hidden="true" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* ── Results ── */}
          {status === "done" && analysis && (
            <section className={styles.results}>
              {sourceName && <p className={styles.sourceName}>Analysis of: {sourceName}</p>}

              <div className={styles.scoreCard} data-tone={scoreTone}>
                <div className={styles.scoreCircle}>
                  <span className={styles.scoreNum}>{analysis.overallScore}</span>
                  <span className={styles.scoreOutOf}>/ 100</span>
                </div>
                <div className={styles.scoreBody}>
                  <span className={styles.scoreEyebrow}>Overall assessment</span>
                  <h2>
                    {scoreTone === "high"
                      ? "Strong CV — small polishing needed"
                      : scoreTone === "mid"
                        ? "Solid foundation, real room to grow"
                        : "Significant upside — let’s rebuild it"}
                  </h2>
                  <p>{analysis.summary}</p>
                </div>
              </div>

              {analysis.strengths.length > 0 && analysis.weaknesses.length > 0 && (
                <div className={styles.twoCol}>
                  <div className={`${styles.listCard} ${styles.strengths}`}>
                    <span className={styles.listBadge} data-tone="positive">
                      <CheckIcon />
                    </span>
                    <h3>Strengths</h3>
                    <ul>
                      {analysis.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={`${styles.listCard} ${styles.weaknesses}`}>
                    <span className={styles.listBadge} data-tone="negative">
                      <SparkleIcon />
                    </span>
                    <h3>Areas to improve</h3>
                    <ul>
                      {analysis.weaknesses.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {analysis.sections.length > 0 && (
                <div className={styles.sections}>
                  <div className={styles.sectionsHeader}>
                    <h3 className={styles.blockTitle}>
                      <ScanIcon /> Section-by-section review
                    </h3>
                    <span className={styles.sectionsCount}>
                      {analysis.sections.length}{" "}
                      {analysis.sections.length === 1 ? "section" : "sections"}
                    </span>
                  </div>
                  {analysis.sections.map((sec, i) => (
                    <div key={i} className={styles.sectionRow}>
                      <div className={styles.sectionHead}>
                        <span className={styles.sectionName}>{sec.name}</span>
                        <span
                          className={styles.ratingPill}
                          data-rating={sec.rating}
                        >
                          {RATING_LABEL[sec.rating]}
                        </span>
                      </div>
                      {sec.feedback && (
                        <p className={styles.sectionFeedback}>{sec.feedback}</p>
                      )}
                      {sec.suggestions.length > 0 && (
                        <ul className={styles.sectionSuggestions}>
                          {sec.suggestions.map((s, j) => (
                            <li key={j}>{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {analysis.missingSections.length > 0 && (
                <div className={styles.missingCard}>
                  <h3>
                    <BookIcon /> Consider adding these sections
                  </h3>
                  <div className={styles.chips}>
                    {analysis.missingSections.map((s, i) => (
                      <span key={i} className={styles.chip}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.actionItems.length > 0 && (
                <div className={styles.actionCard}>
                  <h3>
                    <CheckIcon /> Your action plan
                  </h3>
                  <ol>
                    {analysis.actionItems.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* ── CTA: build a fresh CV ── */}
              <div className={styles.ctaBanner}>
                <div>
                  <span className={styles.ctaEyebrow}>Next step</span>
                  <h3>Ready to build a stronger CV?</h3>
                  <p>
                    Apply this feedback in our guided builder and get a clean,
                    print-ready academic CV in minutes.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.ctaBtn}
                  onClick={buildFromScratch}
                  disabled={creatingCV}
                >
                  {creatingCV ? "Opening…" : "Build a new CV →"}
                </button>
              </div>

              <div className={styles.reanalyzeRow}>
                <button
                  type="button"
                  className={styles.reanalyzeBtn}
                  onClick={() => {
                    setStatus("idle");
                    setAnalysis(null);
                    setSourceName("");
                  }}
                >
                  Analyze a different CV
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/auth/auth-guard";
import NavbarWithAuth from "@/components/layout/navbar-with-auth";
import { useDialog } from "@/components/ui/dialog-provider";
import CVPreview from "@/components/cv/cv-preview";
import { CV_TEMPLATES, DEMO_CV, normalizeCV, type CVData, type CVTemplateId } from "@/lib/cv-types";

// First template in CV_TEMPLATES is the canonical "classic academic" look —
// used as the hero thumbnail so visitors see a real CV, not a stylized icon.
const HERO_TEMPLATE: CVTemplateId = CV_TEMPLATES[0].id;

// The card peeking out from behind the hero thumbnail shows a second,
// visually distinct template (rather than repeating the front one) so the
// "stack of papers" reads as proof of choice, not just a decorative prop.
const HERO_TEMPLATE_BACK: CVTemplateId =
  CV_TEMPLATES.find((t) => t.id === "modern")?.id ?? CV_TEMPLATES[0].id;

// Sample headshot shown in the photo-template thumbnail so its preview reads
// as a real photo CV instead of an empty avatar slot. Other templates keep
// the photo-free demo data.
const DEMO_PHOTO: CVData = { ...DEMO_CV, photo: "/CV-photo.png" };

import styles from "./cv-builder.module.css";

type CVListItem = {
  id: string;
  title: string;
  template: CVTemplateId;
  updated_at: string;
  /** Possibly-partial CVData shape straight from the DB — run through normalizeCV before use. */
  data: unknown;
};

function AnalyzeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v3.25A1.75 1.75 0 0 0 12.75 8H17v10.5A1.5 1.5 0 0 1 15.5 20h-10A1.5 1.5 0 0 1 4 18.5v-14Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M16 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="m8.5 13.8 2.3 2.3 4.7-5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BuildIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 4.5A1.5 1.5 0 0 1 6.5 3h8.379a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 19.5 7.622V19.5A1.5 1.5 0 0 1 18 21H6.5A1.5 1.5 0 0 1 5 19.5v-15Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 11h8M8 14.5h8M8 18h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
      <path
        d="M18 15.5 18.7 17.3 20.5 18 18.7 18.7 18 20.5 17.3 18.7 15.5 18 17.3 17.3 18 15.5Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="4.5"
        width="7"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="13.5"
        y="4.5"
        width="7"
        height="5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="13.5"
        y="12.5"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="3.5"
        y="16.5"
        width="7"
        height="3"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 8v4.2l2.6 1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3.5h7.379a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 19 8.122V18a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18V5.5A2 2 0 0 1 7 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.5 14v4M8.5 16h2M13 18h2a1.5 1.5 0 0 0 0-3h-2v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 7h14M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2m-7 0v11.5A1.5 1.5 0 0 0 9.5 20h5a1.5 1.5 0 0 0 1.5-1.5V7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Layers a real, scaled-up CVPreview inside a "paper" frame with a soft
// floating animation. Renders a second offset card behind it so the hero
// still feels editorial, but the main subject is an actual CV.
function CvHeroThumbnail() {
  return (
    <div className={styles.heroCvStage}>
      <div className={styles.heroCvBack}>
        <div className={styles.heroCvBackInner}>
          <CVPreview
            data={DEMO_CV}
            template={HERO_TEMPLATE_BACK}
            compact
          />
        </div>
      </div>
      <div className={styles.heroCvFrame}>
        <div className={styles.heroCvScale}>
          <CVPreview
            data={DEMO_CV}
            template={HERO_TEMPLATE}
            compact
          />
        </div>
      </div>
    </div>
  );
}

export default function CVBuilderPage() {
  const router = useRouter();
  const dialog = useDialog();

  const [cvs, setCvs] = useState<CVListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // The template picker is a proper modal overlay — lock page scroll while
  // it's open, and let Escape close it like the rest of the app's dialogs.
  useEffect(() => {
    if (!pickerOpen) return;
    // Body alone isn't enough: once body's overflow stops being "visible" it
    // stops propagating to the viewport, so `html` (which has no explicit
    // overflow-y) becomes independently scrollable and the page still moves
    // under the modal. Lock both.
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);

  const loadCVs = () => {
    fetch("/api/cv")
      .then((res) => res.json())
      .then((data) => setCvs(Array.isArray(data.cvs) ? data.cvs : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(loadCVs, []);

  const createCV = async (template: CVTemplateId) => {
    setCreating(true);
    try {
      const res = await fetch("/api/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, title: "Untitled CV" }),
      });
      const data = await res.json();
      if (res.ok && data.cv?.id) {
        router.push(`/cv-builder/${data.cv.id}`);
      } else {
        await dialog.alert({ title: "Error", description: "Could not create a new CV." });
        setCreating(false);
      }
    } catch {
      await dialog.alert({ title: "Error", description: "Could not create a new CV." });
      setCreating(false);
    }
  };

  const deleteCV = async (cv: CVListItem) => {
    const ok = await dialog.confirm({
      title: "Delete CV",
      description: `Delete "${cv.title || "Untitled CV"}"? This can't be undone.`,
      confirmText: "Delete",
      isDestructive: true,
    });
    if (!ok) return;
    await fetch(`/api/cv/${cv.id}`, { method: "DELETE" });
    setCvs((prev) => prev.filter((c) => c.id !== cv.id));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <AuthGuard>
      <div className={styles.page}>
        <NavbarWithAuth />

        <main className={styles.main}>
          {/* ── Hero ── */}
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>
                <SparkleIcon /> CV Builder
              </span>
              <h1>
                An academic CV that <span className={styles.heroAccent}>opens doors</span>.
              </h1>
              <p className={styles.subtitle}>
                Start from a proven template — or let our AI review your current CV first
                and tell you exactly what to improve. Then export a print-ready PDF in
                one click.
              </p>

              <div className={styles.heroActions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => setPickerOpen(true)}
                  disabled={creating}
                >
                  {creating ? "Creating…" : "Create new CV"}
                </button>
                <Link href="/cv-builder/analyze" className={styles.secondaryBtn}>
                  Analyze my current CV
                </Link>
              </div>

              <ul className={styles.heroBadges}>
                <li>
                  <span className={styles.heroBadgeDot} data-color="teal" />
                  Print-ready PDF
                </li>
                <li>
                  <span className={styles.heroBadgeDot} data-color="coral" />
                  AI feedback in seconds
                </li>
                <li>
                  <span className={styles.heroBadgeDot} data-color="sand" />
                  100% private
                </li>
              </ul>
            </div>

            <div className={styles.heroVisual} aria-hidden="true">
              <CvHeroThumbnail />
            </div>
          </section>

          {/* ── Two entry points ── */}
          <section className={styles.choices} aria-label="Get started">
            <article
              className={styles.choiceCard}
              data-variant="analyze"
              onClick={() => router.push("/cv-builder/analyze")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push("/cv-builder/analyze");
                }
              }}
            >
              <span className={styles.choiceIconWrap} aria-hidden="true">
                <AnalyzeIcon />
              </span>
              <span className={styles.choiceBadge} data-variant="analyze">
                Step 1 · Optional
              </span>
              <h2>Analyze your current CV</h2>
              <p>
                Already have a CV? Upload it and our advanced AI models will score it and
                give section-by-section suggestions — so your new one is even stronger.
              </p>
              <span className={styles.choiceLink}>
                Analyze my CV <span aria-hidden="true">→</span>
              </span>
            </article>

            <article className={styles.choiceCard} data-variant="build">
              <span className={styles.choiceIconWrap} aria-hidden="true">
                <BuildIcon />
              </span>
              <span className={styles.choiceBadge} data-variant="build">
                Step 2
              </span>
              <h2>Build a new academic CV</h2>
              <p>
                Fill in your details in a guided form and watch a clean, print-ready CV
                take shape in real time. Pick from four academic templates.
              </p>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => setPickerOpen((v) => !v)}
                disabled={creating}
              >
                {pickerOpen ? "Hide templates" : creating ? "Creating…" : "Choose a template"}
              </button>
            </article>
          </section>

          {/* ── Template picker ──
              Rendered via a portal straight into <body> so it always paints
              above the navbar, regardless of any z-index/stacking context
              set up by ancestors like .main. */}
          {pickerOpen &&
            createPortal(
              <div
                className={styles.templatePickerBackdrop}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setPickerOpen(false);
                }}
              >
                <section className={styles.templatePicker} role="dialog" aria-modal="true" aria-label="Choose a template">
                  <div className={styles.templatePickerHeader}>
                    <div>
                      <h3>Choose a template</h3>
                      <p className={styles.templatePickerHint}>
                        Live preview of a sample academic CV in all {CV_TEMPLATES.length} styles.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.pickerClose}
                      onClick={() => setPickerOpen(false)}
                      aria-label="Close template picker"
                    >
                      ✕
                    </button>
                  </div>
                  <div className={styles.templateGrid}>
                    {CV_TEMPLATES.map((tpl, i) => (
                      <div key={tpl.id} className={styles.templateCard}>
                        {i === 0 && <span className={styles.templateBadge}>Most popular</span>}
                        <span className={styles.previewFrame} data-template={tpl.id} aria-hidden="true">
                          <span className={styles.previewScale}>
                            <CVPreview
                              data={tpl.id === "photo" ? DEMO_PHOTO : DEMO_CV}
                              template={tpl.id}
                              compact
                            />
                          </span>
                          <span className={styles.previewFade} />
                        </span>
                        <div className={styles.templateBody}>
                          <strong>{tpl.name}</strong>
                          <span className={styles.templateDesc}>{tpl.description}</span>
                          <button
                            type="button"
                            className={styles.templateChoose}
                            onClick={() => createCV(tpl.id)}
                            disabled={creating}
                          >
                            {creating ? "Creating…" : "Use this template"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>,
              document.body,
            )}

          {/* ── Features strip ── */}
          <section className={styles.features} aria-label="Why use this builder">
            <div className={styles.featureItem}>
              <span className={styles.featureIcon} data-color="teal">
                <TemplateIcon />
              </span>
              <div>
                <strong>Committee-ready templates</strong>
                <p>Four formats vetted by grad-school admissions — classic, modern, Europass, or photo-friendly.</p>
              </div>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon} data-color="coral">
                <SparkleIcon />
              </span>
              <div>
                <strong>AI feedback you can trust</strong>
                <p>Advanced AI models review your CV section by section, in under 30 seconds.</p>
              </div>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon} data-color="sand">
                <ClockIcon />
              </span>
              <div>
                <strong>Autosaved as you type</strong>
                <p>Drafts persist across devices — pick up exactly where you left off.</p>
              </div>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon} data-color="teal">
                <PdfIcon />
              </span>
              <div>
                <strong>One-click PDF export</strong>
                <p>Pixel-perfect print output — no broken line breaks, no missing glyphs.</p>
              </div>
            </div>
          </section>

          {/* ── How it works ── */}
          <section className={styles.howItWorks} aria-label="How it works">
            <h2 className={styles.sectionTitle}>How it works</h2>
            <ol className={styles.stepList}>
              <li className={styles.step}>
                <span className={styles.stepNumber}>1</span>
                <h3>Pick your starting point</h3>
                <p>
                  Either analyze an existing CV for instant feedback, or jump straight into
                  building from a template.
                </p>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNumber}>2</span>
                <h3>Fill the guided form</h3>
                <p>
                  Education, research, awards, publications — every section is structured
                  the way admissions committees expect.
                </p>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNumber}>3</span>
                <h3>Preview & export</h3>
                <p>
                  See your CV update live. Export a print-ready PDF and share your
                  application link.
                </p>
              </li>
            </ol>
          </section>

          {/* ── Saved CVs ── */}
          <section className={styles.savedSection} aria-label="Your saved CVs">
            <div className={styles.savedHeader}>
              <h2 className={styles.sectionTitle}>Your CVs</h2>
              {!loading && cvs.length > 0 && (
                <span className={styles.savedCount}>
                  {cvs.length} {cvs.length === 1 ? "draft" : "drafts"}
                </span>
              )}
            </div>

            {loading ? (
              <div className={styles.savedGrid}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`${styles.savedCard} ${styles.savedCardSkeleton}`} />
                ))}
              </div>
            ) : cvs.length === 0 ? (
              <div className={styles.savedEmpty}>
                <span className={styles.savedEmptyIcon} aria-hidden="true">
                  <BuildIcon />
                </span>
                <div>
                  <strong>No CVs yet</strong>
                  <p>
                    Click <em>Create new CV</em> above to start your first academic CV from
                    a template.
                  </p>
                </div>
              </div>
            ) : (
              <ul className={styles.savedGrid}>
                {cvs.map((cv) => {
                  const tplName =
                    CV_TEMPLATES.find((t) => t.id === cv.template)?.name ?? cv.template;
                  return (
                    <li key={cv.id} className={styles.savedCard}>
                      <Link href={`/cv-builder/${cv.id}`} className={styles.savedCardLink}>
                        <span className={styles.savedPreview} aria-hidden="true">
                          <span className={styles.savedPreviewScale}>
                            <CVPreview
                              data={normalizeCV(cv.data)}
                              template={cv.template}
                              compact
                            />
                          </span>
                        </span>
                        <span className={styles.savedCardBody}>
                          <strong className={styles.savedCardTitle}>
                            {cv.title || "Untitled CV"}
                          </strong>
                          <span className={styles.savedCardMeta}>
                            {tplName} · Updated {formatDate(cv.updated_at)}
                          </span>
                          <span className={styles.savedCardCta}>
                            Open <span aria-hidden="true">→</span>
                          </span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        className={styles.savedCardDelete}
                        onClick={() => deleteCV(cv)}
                        aria-label={`Delete ${cv.title || "Untitled CV"}`}
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <footer className={styles.pageFooter}>
            Stuck? Try the{" "}
            <Link href="/cv-builder/analyze">AI analyzer</Link> for a free review of any
            CV draft — even a Word document.
          </footer>
        </main>
      </div>
    </AuthGuard>
  );
}

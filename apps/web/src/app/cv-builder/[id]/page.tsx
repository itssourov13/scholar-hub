"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/auth/auth-guard";
import NavbarWithAuth from "@/components/layout/navbar-with-auth";
import { useDialog } from "@/components/ui/dialog-provider";
import CVPreview from "@/components/cv/cv-preview";
import {
  CV_TEMPLATES,
  DEFAULT_SECTION_ORDER,
  EMPTY_AWARD,
  EMPTY_EDUCATION,
  EMPTY_EXPERIENCE,
  EMPTY_PROJECT,
  EMPTY_PUBLICATION,
  EMPTY_REFERENCE,
  EMPTY_SKILL,
  EMPTY_TEXT,
  emptyCV,
  normalizeCV,
  templateAllowsPhoto,
  type CVData,
  type CVTemplateId,
  type SectionKey,
} from "@/lib/cv-types";
import { fileToResizedDataUrl } from "@/lib/client-image";
import styles from "./editor.module.css";

export default function CVEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const dialog = useDialog();

  const [title, setTitle] = useState("Untitled CV");
  const [template, setTemplate] = useState<CVTemplateId>("classic");
  const [data, setData] = useState<CVData>(emptyCV());
  const [snapshot, setSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/cv/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const { cv } = await res.json();
        const normalized = normalizeCV(cv.data);
        setTitle(cv.title || "Untitled CV");
        setTemplate((cv.template as CVTemplateId) || "classic");
        setData(normalized);
        setSnapshot(JSON.stringify({ title: cv.title, template: cv.template, data: normalized }));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const isDirty = useMemo(
    () => snapshot !== JSON.stringify({ title, template, data }),
    [snapshot, title, template, data],
  );

  const save = async (opts?: { silent?: boolean }) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cv/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, template, data }),
      });
      if (res.ok) {
        setSnapshot(JSON.stringify({ title, template, data }));
      } else if (!opts?.silent) {
        await dialog.alert({ title: "Error", description: "Could not save your CV." });
      }
    } catch {
      // Autosave retries silently on the next debounce tick; only surface
      // the failure for an explicit user-initiated save.
      if (!opts?.silent) {
        await dialog.alert({ title: "Error", description: "Could not save your CV." });
      }
    }
    setSaving(false);
  };

  // Autosave: wait for a pause in editing, then save. Skips while a load or
  // another save is in flight; re-arms itself once that save finishes if the
  // user kept typing in the meantime.
  useEffect(() => {
    if (loading || saving || !isDirty) return;
    const t = setTimeout(() => {
      save({ silent: true });
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, template, data, loading, saving, isDirty]);

  // Safety net for the debounce window: warn before closing/navigating away
  // with unsaved changes still pending.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleDownload = async () => {
    if (isDirty) await save();
    setView("preview");
    setTimeout(() => window.print(), 120);
  };

  // ── field update helpers ──
  const setField = <K extends keyof CVData>(key: K, value: CVData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  // Europass never shows a photo (see templateAllowsPhoto) — keep the
  // editor's toggle in sync so it doesn't look "on" for a hidden photo.
  const handleTemplateChange = (t: CVTemplateId) => {
    setTemplate(t);
    if (!templateAllowsPhoto(t)) setField("showPhoto", false);
  };

  type ListKeys = {
    [K in keyof CVData]: CVData[K] extends unknown[] ? K : never;
  }[keyof CVData];

  const updateItem = (key: ListKeys, index: number, patch: Record<string, unknown>) =>
    setData((d) => {
      const arr = [...(d[key] as Record<string, unknown>[])];
      arr[index] = { ...arr[index], ...patch };
      return { ...d, [key]: arr };
    });

  const addItem = (key: ListKeys, empty: unknown) =>
    setData((d) => ({ ...d, [key]: [...(d[key] as unknown[]), { ...(empty as object) }] }));

  const removeItem = (key: ListKeys, index: number) =>
    setData((d) => ({
      ...d,
      [key]: (d[key] as unknown[]).filter((_, i) => i !== index),
    }));

  const sectionOrder = data.sectionOrder?.length ? data.sectionOrder : DEFAULT_SECTION_ORDER;

  const moveSection = (from: number, to: number) => {
    if (to < 0 || to >= sectionOrder.length || from === to) return;
    const next = [...sectionOrder];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setField("sectionOrder", next);
  };

  // One entry per reorderable section (everything except the pinned header).
  // Rendered in `sectionOrder` so drag-and-drop in the editor stays in sync
  // with the render order used by CVPreview.
  const sectionDefs: { key: SectionKey; title: string; node: React.ReactNode }[] = [
    {
      key: "researchInterests",
      title: "Research interests",
      node: (
        <Group title="Research interests">
          <Area
            label="Research interests"
            value={data.researchInterests}
            onChange={(v) => setField("researchInterests", v)}
            placeholder="A concise statement of your research focus areas."
          />
        </Group>
      ),
    },
    {
      key: "summary",
      title: "Profile summary",
      node: (
        <Group title="Profile summary (optional)">
          <Area
            label="Summary"
            value={data.summary}
            onChange={(v) => setField("summary", v)}
            placeholder="A short paragraph introducing yourself."
          />
        </Group>
      ),
    },
    {
      key: "education",
      title: "Education",
      node: (
        <RepeatGroup title="Education" count={data.education.length} onAdd={() => addItem("education", EMPTY_EDUCATION)}>
          {data.education.map((e, i) => (
            <Entry key={i} onRemove={() => removeItem("education", i)}>
              <Row>
                <Text label="Degree" value={e.degree} onChange={(v) => updateItem("education", i, { degree: v })} placeholder="BSc" />
                <Text label="Field" value={e.field} onChange={(v) => updateItem("education", i, { field: v })} placeholder="Computer Science" />
              </Row>
              <Row>
                <Text label="Institution" value={e.institution} onChange={(v) => updateItem("education", i, { institution: v })} />
                <Text label="Location" value={e.location} onChange={(v) => updateItem("education", i, { location: v })} />
              </Row>
              <Row>
                <Text label="Start" value={e.startDate} onChange={(v) => updateItem("education", i, { startDate: v })} placeholder="2020" />
                <Text label="End" value={e.endDate} onChange={(v) => updateItem("education", i, { endDate: v })} placeholder="2024 (or Present)" />
                <Text label="CGPA" value={e.gpa} onChange={(v) => updateItem("education", i, { gpa: v })} placeholder="3.85 / 4.00" />
              </Row>
              <Area label="Details (optional)" value={e.details} onChange={(v) => updateItem("education", i, { details: v })} placeholder="Thesis title, honours, relevant coursework…" />
            </Entry>
          ))}
        </RepeatGroup>
      ),
    },
    {
      key: "researchExperience",
      title: "Research experience",
      node: (
        <ExperienceGroup
          title="Research experience"
          items={data.researchExperience}
          keyName="researchExperience"
          addItem={addItem}
          removeItem={removeItem}
          updateItem={updateItem}
        />
      ),
    },
    {
      key: "publications",
      title: "Publications",
      node: (
        <RepeatGroup
          title="Publications"
          count={data.publications.length}
          onAdd={() => addItem("publications", EMPTY_PUBLICATION)}
        >
          {data.publications.map((p, i) => (
            <Entry key={i} onRemove={() => removeItem("publications", i)}>
              <Text label="Paper title" value={p.title} onChange={(v) => updateItem("publications", i, { title: v })} placeholder="Low-resource clinical NER for Bengali" />
              <Text label="Journal / proceedings" value={p.venue} onChange={(v) => updateItem("publications", i, { venue: v })} placeholder="Proc. of ACL Student Workshop" />
              <Row>
                <Text label="Date" value={p.date} onChange={(v) => updateItem("publications", i, { date: v })} placeholder="2024" />
                <Text label="DOI / link" value={p.doi} onChange={(v) => updateItem("publications", i, { doi: v })} placeholder="10.1109/xyz or full URL" />
              </Row>
            </Entry>
          ))}
        </RepeatGroup>
      ),
    },
    {
      key: "teachingExperience",
      title: "Teaching experience",
      node: (
        <ExperienceGroup
          title="Teaching experience"
          items={data.teachingExperience}
          keyName="teachingExperience"
          addItem={addItem}
          removeItem={removeItem}
          updateItem={updateItem}
        />
      ),
    },
    {
      key: "workExperience",
      title: "Professional experience",
      node: (
        <ExperienceGroup
          title="Professional experience"
          items={data.workExperience}
          keyName="workExperience"
          addItem={addItem}
          removeItem={removeItem}
          updateItem={updateItem}
        />
      ),
    },
    {
      key: "projects",
      title: "Projects",
      node: (
        <RepeatGroup
          title="Projects"
          count={data.projects.length}
          onAdd={() => addItem("projects", EMPTY_PROJECT)}
        >
          {data.projects.map((p, i) => (
            <Entry key={i} onRemove={() => removeItem("projects", i)}>
              <Row>
                <Text label="Title" value={p.title} onChange={(v) => updateItem("projects", i, { title: v })} placeholder="Bengali Clinical NER Toolkit" />
                <Text label="Context (optional)" value={p.organization} onChange={(v) => updateItem("projects", i, { organization: v })} placeholder="Course project, hackathon, company…" />
              </Row>
              <Row>
                <Text label="Link (optional)" value={p.link} onChange={(v) => updateItem("projects", i, { link: v })} placeholder="https://github.com/…" />
                <Text label="Start" value={p.startDate} onChange={(v) => updateItem("projects", i, { startDate: v })} placeholder="2023" />
                <Text label="End" value={p.endDate} onChange={(v) => updateItem("projects", i, { endDate: v })} placeholder="2023 (or Present)" />
              </Row>
              <Area label="Description" value={p.description} onChange={(v) => updateItem("projects", i, { description: v })} placeholder="What it does and what you built. One point per line." />
            </Entry>
          ))}
        </RepeatGroup>
      ),
    },
    {
      key: "presentations",
      title: "Conferences & presentations",
      node: (
        <RepeatGroup title="Conferences & presentations" count={data.presentations.length} onAdd={() => addItem("presentations", EMPTY_TEXT)}>
          {data.presentations.map((p, i) => (
            <Entry key={i} onRemove={() => removeItem("presentations", i)}>
              <Area
                label={`Presentation ${i + 1}`}
                value={p.text}
                onChange={(v) => updateItem("presentations", i, { text: v })}
                placeholder="Title, event, location, year."
              />
            </Entry>
          ))}
        </RepeatGroup>
      ),
    },
    {
      key: "awards",
      title: "Awards & honours",
      node: (
        <RepeatGroup title="Awards & honours" count={data.awards.length} onAdd={() => addItem("awards", EMPTY_AWARD)}>
          {data.awards.map((a, i) => (
            <Entry key={i} onRemove={() => removeItem("awards", i)}>
              <Row>
                <Text label="Title" value={a.title} onChange={(v) => updateItem("awards", i, { title: v })} />
                <Text label="Issuer" value={a.issuer} onChange={(v) => updateItem("awards", i, { issuer: v })} />
                <Text label="Year" value={a.year} onChange={(v) => updateItem("awards", i, { year: v })} />
              </Row>
              <Area label="Details (optional)" value={a.description} onChange={(v) => updateItem("awards", i, { description: v })} />
            </Entry>
          ))}
        </RepeatGroup>
      ),
    },
    {
      key: "skills",
      title: "Skills",
      node: (
        <RepeatGroup
          title="Skills"
          count={data.skills.length}
          onAdd={() => addItem("skills", EMPTY_SKILL)}
          hint="Group skills by category, e.g. Programming, Lab techniques."
        >
          {data.skills.map((s, i) => (
            <Entry key={i} onRemove={() => removeItem("skills", i)}>
              <Row>
                <Text label="Category" value={s.category} onChange={(v) => updateItem("skills", i, { category: v })} placeholder="Programming" />
                <Text label="Items" value={s.items} onChange={(v) => updateItem("skills", i, { items: v })} placeholder="Python, R, C++" />
              </Row>
            </Entry>
          ))}
        </RepeatGroup>
      ),
    },
    {
      key: "languages",
      title: "Languages",
      node: (
        <RepeatGroup title="Languages" count={data.languages.length} onAdd={() => addItem("languages", EMPTY_TEXT)}>
          {data.languages.map((l, i) => (
            <Entry key={i} onRemove={() => removeItem("languages", i)}>
              <Text label={`Language ${i + 1}`} value={l.text} onChange={(v) => updateItem("languages", i, { text: v })} placeholder="English (IELTS 7.5)" />
            </Entry>
          ))}
        </RepeatGroup>
      ),
    },
    {
      key: "references",
      title: "References",
      node: (
        <RepeatGroup
          title="References"
          count={data.references.length}
          onAdd={() => addItem("references", EMPTY_REFERENCE)}
          hint="Name, affiliation, and how they know you — e.g. “Prof. Karim, Dept. of CSE, BUET, Thesis supervisor”."
        >
          {data.references.map((r, i) => (
            <Entry key={i} onRemove={() => removeItem("references", i)}>
              <Row>
                <Text label="Name" value={r.name} onChange={(v) => updateItem("references", i, { name: v })} />
                <Text label="Affiliation" value={r.affiliation} onChange={(v) => updateItem("references", i, { affiliation: v })} placeholder="Professor, Dept. of CSE, BUET" />
              </Row>
              <Row>
                <Text label="Relation" value={r.relation} onChange={(v) => updateItem("references", i, { relation: v })} placeholder="Thesis supervisor" />
                <Text label="Email" value={r.email} onChange={(v) => updateItem("references", i, { email: v })} />
              </Row>
            </Entry>
          ))}
        </RepeatGroup>
      ),
    },
  ];

  const orderedSectionDefs = sectionOrder
    .map((key) => sectionDefs.find((s) => s.key === key))
    .filter((s): s is (typeof sectionDefs)[number] => Boolean(s));

  if (notFound) {
    return (
      <AuthGuard>
        <div className={styles.page}>
          <NavbarWithAuth />
          <main className={styles.main}>
            <p className={styles.muted}>This CV could not be found.</p>
            <Link href="/cv-builder" className={styles.back}>
              ← Back to CV Builder
            </Link>
          </main>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className={styles.page}>
        <div data-noprint>
          <NavbarWithAuth />
        </div>

        {/* ── Toolbar ── */}
        <div className={styles.toolbar} data-noprint>
          <div className={styles.toolbarLeft}>
            <Link href="/cv-builder" className={styles.back}>
              ←
            </Link>
            <input
              className={styles.titleInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="CV title"
              aria-label="CV title"
            />
          </div>
          <div className={styles.toolbarRight}>
            <TemplateSelect value={template} onChange={handleTemplateChange} />
            <div className={styles.viewToggle}>
              <button
                className={view === "edit" ? styles.viewActive : styles.viewBtn}
                onClick={() => setView("edit")}
              >
                Edit
              </button>
              <button
                className={view === "preview" ? styles.viewActive : styles.viewBtn}
                onClick={() => setView("preview")}
              >
                Preview
              </button>
            </div>
            <button className={styles.saveBtn} onClick={() => save()} disabled={saving || !isDirty}>
              {saving ? "Saving…" : isDirty ? "Save" : "Saved"}
            </button>
            <button className={styles.downloadBtn} onClick={handleDownload}>
              Download PDF
            </button>
          </div>
        </div>

        {loading ? (
          <main className={styles.main}>
            <p className={styles.muted}>Loading…</p>
          </main>
        ) : (
          <div className={`${styles.workspace} ${styles[`view_${view}`]}`}>
            {/* ── Editor panel ── */}
            <div className={styles.editorPanel} data-noprint>
              <Group title="Header & contact">
                <Row>
                  <Text label="Full name" value={data.fullName} onChange={(v) => setField("fullName", v)} />
                  <Text label="Headline" value={data.headline} onChange={(v) => setField("headline", v)} placeholder="e.g. Prospective PhD student in Computer Science" />
                </Row>
                <Row>
                  <Text label="Email" value={data.email} onChange={(v) => setField("email", v)} />
                  <Text label="Phone" value={data.phone} onChange={(v) => setField("phone", v)} />
                </Row>
                <Row>
                  <Text label="Location" value={data.location} onChange={(v) => setField("location", v)} placeholder="Dhaka, Bangladesh" />
                  <Text label="Website / LinkedIn" value={data.website} onChange={(v) => setField("website", v)} />
                </Row>
                <Row>
                  <Text label="GitHub" value={data.githubUrl} onChange={(v) => setField("githubUrl", v)} placeholder="https://github.com/username" />
                  <Text label="Google Scholar" value={data.googleScholarUrl} onChange={(v) => setField("googleScholarUrl", v)} placeholder="https://scholar.google.com/citations?user=…" />
                </Row>
                <Row>
                  <Text label="ORCID" value={data.orcid} onChange={(v) => setField("orcid", v)} placeholder="https://orcid.org/0000-0000-0000-0000" />
                  <Text label="Kaggle" value={data.kaggleUrl} onChange={(v) => setField("kaggleUrl", v)} placeholder="https://kaggle.com/username" />
                </Row>
                <PhotoField
                  value={data.photo}
                  onChange={(v) => setField("photo", v)}
                  show={data.showPhoto}
                  onShowChange={(v) => setField("showPhoto", v)}
                  disabled={!templateAllowsPhoto(template)}
                />
              </Group>

              {/* Everything below is reorderable — drag the grip handle or use
                  the ↑/↓ buttons to change where a section appears in the CV. */}
              {orderedSectionDefs.map((section, i) => (
                <SortableSection
                  key={section.key}
                  label={section.title}
                  index={i}
                  total={orderedSectionDefs.length}
                  isDragging={dragIndex === i}
                  isDragOver={overIndex === i && dragIndex !== null && dragIndex !== i}
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={() => setOverIndex(i)}
                  onDrop={() => {
                    if (dragIndex !== null) moveSection(dragIndex, i);
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  onMove={(dir) => moveSection(i, i + dir)}
                >
                  {section.node}
                </SortableSection>
              ))}
            </div>

            {/* ── Preview panel ── */}
            <div className={styles.previewPanel}>
              <div className={styles.previewScroll}>
                <CVPreview data={data} template={template} printable />
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

/* ── Reusable editor primitives ─────────────────────────────────────────── */

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="6" r="1.5" fill="currentColor" />
      <circle cx="15" cy="6" r="1.5" fill="currentColor" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" />
      <circle cx="9" cy="18" r="1.5" fill="currentColor" />
      <circle cx="15" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** Custom template picker — replaces the native <select>, which can't be
 * styled consistently across browsers (see the default OS dropdown list). */
function TemplateSelect({
  value,
  onChange,
}: {
  value: CVTemplateId;
  onChange: (v: CVTemplateId) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = CV_TEMPLATES.find((t) => t.id === value) ?? CV_TEMPLATES[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.templateSelect} ref={rootRef}>
      <button
        type="button"
        className={styles.templateSelectTrigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Template"
      >
        <span>{current.name}</span>
        <span className={open ? styles.templateSelectChevronOpen : styles.templateSelectChevron}>
          <ChevronIcon />
        </span>
      </button>
      {open && (
        <div className={styles.templateSelectMenu} role="listbox" aria-label="Choose a template">
          {CV_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={t.id === value}
              className={
                t.id === value ? styles.templateSelectOptionActive : styles.templateSelectOption
              }
              onClick={() => {
                onChange(t.id);
                setOpen(false);
              }}
            >
              <span className={styles.templateSelectOptionText}>
                <span className={styles.templateSelectOptionName}>{t.name}</span>
                <span className={styles.templateSelectOptionDesc}>{t.description}</span>
              </span>
              {t.id === value && (
                <span className={styles.templateSelectCheck}>
                  <CheckIcon />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Wraps a section with a drag handle + ↑/↓ buttons so its position in the
 * CV can be reordered. Only the handle itself is `draggable`, so dragging
 * doesn't interfere with selecting text or interacting with fields inside. */
function SortableSection({
  label,
  index,
  total,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
  children,
}: {
  label: string;
  index: number;
  total: number;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onMove: (direction: -1 | 1) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${styles.sortableSection} ${isDragging ? styles.sortableDragging : ""} ${
        isDragOver ? styles.sortableDragOver : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <div className={styles.sortableHandleRail} data-noprint>
        <button
          type="button"
          className={styles.dragHandle}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          aria-label={`Drag to reorder ${label}`}
          title="Drag to reorder"
        >
          <GripIcon />
        </button>
        <div className={styles.moveButtons}>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Move ${label} up`}
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label={`Move ${label} down`}
            title="Move down"
          >
            ↓
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.group}>
      <h2 className={styles.groupTitle}>{title}</h2>
      {children}
    </section>
  );
}

function RepeatGroup({
  title,
  count,
  onAdd,
  hint,
  children,
}: {
  title: string;
  count: number;
  onAdd: () => void;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.group}>
      <h2 className={styles.groupTitle}>{title}</h2>
      {hint && <p className={styles.groupHint}>{hint}</p>}
      {count === 0 && <p className={styles.emptyHint}>No entries yet.</p>}
      <div className={styles.entryStack}>{children}</div>
      <button type="button" className={styles.addBtn} onClick={onAdd}>
        + Add {title.toLowerCase()}
      </button>
    </section>
  );
}

function Entry({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className={styles.entryCard}>
      <button type="button" className={styles.removeBtn} onClick={onRemove} aria-label="Remove entry">
        ×
      </button>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

/** Profile photo picker. Resizes the chosen image in the browser and stores
 * it inline as a data URL on `data.photo` (used by the "Spotlight" template).
 * `show`/`onShowChange` let the photo stay uploaded but hidden from the CV;
 * `disabled` is set for templates (Europass) that never render a photo. */
function PhotoField({
  value,
  onChange,
  show,
  onShowChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onShowChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File | undefined) => {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setBusy(true);
    try {
      onChange(await fileToResizedDataUrl(file, 400, 0.85));
    } catch {
      setError("Could not process that image. Try a different file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (disabled) {
    return (
      <div className={styles.photoField}>
        <span className={styles.label}>Profile photo</span>
        <p className={styles.photoDisabledHint}>
          The Europass format is standardized and never includes a photo.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.photoField}>
      <span className={styles.label}>Profile photo</span>
      <div className={styles.photoRow}>
        <span className={styles.photoPreview}>
          {value ? (
            // Local data URL — plain <img> is intentional (no next/image).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Profile preview" />
          ) : (
            <span className={styles.photoPlaceholder} aria-hidden="true" />
          )}
        </span>
        <div className={styles.photoActions}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className={styles.photoInput}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className={styles.photoBtn}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Processing…" : value ? "Change photo" : "Upload photo"}
          </button>
          {value && (
            <button type="button" className={styles.photoRemove} onClick={() => onChange("")}>
              Remove
            </button>
          )}
          {value && (
            <label className={styles.photoToggle}>
              <input type="checkbox" checked={show} onChange={(e) => onShowChange(e.target.checked)} />
              Show photo on CV
            </label>
          )}
          <p className={styles.photoHint}>
            {error || "Shown on the “Spotlight” template. Square images work best."}
          </p>
        </div>
      </div>
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className={`${styles.field} ${styles.fieldFull}`}>
      <span className={styles.label}>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} />
    </label>
  );
}

/* Shared editor for the three experience-style sections. */
function ExperienceGroup({
  title,
  items,
  keyName,
  addItem,
  removeItem,
  updateItem,
}: {
  title: string;
  items: { role: string; organization: string; location: string; startDate: string; endDate: string; description: string }[];
  keyName: "researchExperience" | "workExperience" | "teachingExperience";
  addItem: (key: "researchExperience" | "workExperience" | "teachingExperience", empty: unknown) => void;
  removeItem: (key: "researchExperience" | "workExperience" | "teachingExperience", index: number) => void;
  updateItem: (key: "researchExperience" | "workExperience" | "teachingExperience", index: number, patch: Record<string, unknown>) => void;
}) {
  return (
    <RepeatGroup title={title} count={items.length} onAdd={() => addItem(keyName, EMPTY_EXPERIENCE)}>
      {items.map((e, i) => (
        <Entry key={i} onRemove={() => removeItem(keyName, i)}>
          <Row>
            <Text label="Role" value={e.role} onChange={(v) => updateItem(keyName, i, { role: v })} placeholder="Research Assistant" />
            <Text label="Organization" value={e.organization} onChange={(v) => updateItem(keyName, i, { organization: v })} />
          </Row>
          <Row>
            <Text label="Location" value={e.location} onChange={(v) => updateItem(keyName, i, { location: v })} />
            <Text label="Start" value={e.startDate} onChange={(v) => updateItem(keyName, i, { startDate: v })} placeholder="Jan 2023" />
            <Text label="End" value={e.endDate} onChange={(v) => updateItem(keyName, i, { endDate: v })} placeholder="Present" />
          </Row>
          <Area label="Description" value={e.description} onChange={(v) => updateItem(keyName, i, { description: v })} placeholder="What you did and achieved. One point per line." />
        </Entry>
      ))}
    </RepeatGroup>
  );
}

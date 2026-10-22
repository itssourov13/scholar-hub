"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_SECTION_ORDER, templateAllowsPhoto } from "@/lib/cv-types";
import type {
  CVData,
  CVTemplateId,
  ExperienceEntry,
  EducationEntry,
  ProjectEntry,
  PublicationEntry,
  SectionKey,
} from "@/lib/cv-types";
import styles from "./cv-preview.module.css";

type CVPreviewProps = {
  data: CVData;
  template: CVTemplateId;
  /** Marks this instance as the print target (only one should be on a page). */
  printable?: boolean;
  /** Fill-width, no shadow/rounding — for scaled thumbnail previews. */
  compact?: boolean;
};

/** The `.printable` page's true, print-accurate width (see cv-preview.module.css). */
const PAGE_WIDTH = 820;

/**
 * Shrinks the printable preview to fit whatever width its column has,
 * so the full page is always visible instead of being cropped/scrolled.
 * `zoom` (rather than `transform: scale`) resizes the box's own layout,
 * so the scrollable wrapper shrinks to match — no leftover blank space.
 *
 * The zoom is applied inline, which would otherwise also shrink the
 * actual print/PDF output (inline styles beat the `@media print` reset
 * in cv-preview.module.css) — so it's forced back to 1 for the
 * `beforeprint`/`afterprint` window around window.print().
 */
function usePageFitZoom(enabled: boolean) {
  const ref = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    if (!enabled) return;
    const container = ref.current?.parentElement;
    if (!container) return;

    // Use the container's content-box width (its padding isn't usable
    // space for the page), not clientWidth, which includes padding and
    // would let the scaled page overflow it.
    const contentWidth = () => {
      const cs = getComputedStyle(container);
      return container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    };
    const applyWidth = (width: number) => {
      setZoom(width > 0 ? Math.min(1, width / PAGE_WIDTH) : 1);
    };
    const update = () => applyWidth(contentWidth());
    update();

    const ro = new ResizeObserver((entries) => {
      const contentRect = entries[0]?.contentRect;
      applyWidth(contentRect ? contentRect.width : contentWidth());
    });
    ro.observe(container);

    // Mutate the DOM directly (rather than via setState) so the reset is
    // guaranteed to apply before the browser captures the print snapshot —
    // window.print() can render synchronously right after "beforeprint".
    const restoreForPrint = () => {
      if (ref.current) ref.current.style.zoom = "1";
    };
    window.addEventListener("beforeprint", restoreForPrint);
    window.addEventListener("afterprint", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("beforeprint", restoreForPrint);
      window.removeEventListener("afterprint", update);
    };
  }, [enabled]);

  return { ref, zoom };
}

const dateRange = (start: string, end: string): string => {
  const s = start.trim();
  const e = end.trim();
  if (s && e) return `${s} \u2013 ${e}`;
  return s || e || "";
};

function hasContent(v: string | undefined): boolean {
  return Boolean(v && v.trim());
}

/** Bare DOIs (e.g. "10.1109/xyz") link to doi.org; full URLs pass through as-is. */
function doiHref(doi: string): string {
  const d = doi.trim();
  return /^https?:\/\//i.test(d) ? d : `https://doi.org/${d}`;
}

/** The "Website / LinkedIn" field shows a clean label (like GitHub/ORCID)
 * instead of the raw URL — detect which one was entered. */
function websiteLabel(url: string): string {
  return /linkedin\.com/i.test(url) ? "LinkedIn" : "Website";
}

/** Renders a real link normally, or plain text in `compact` thumbnails —
 * those are always nested inside another clickable element (a card `<Link>`
 * or template-picker `<button>`), where a nested `<a>` would be invalid
 * HTML and could hijack clicks meant for the outer element. */
function MaybeLink({
  href,
  compact,
  className,
  children,
}: {
  href: string;
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (compact) return <span className={className}>{children}</span>;
  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}

function ExperienceList({ entries }: { entries: ExperienceEntry[] }) {
  const shown = entries.filter((e) => e.role || e.organization || e.description);
  if (shown.length === 0) return null;
  return (
    <div className={styles.entryList}>
      {shown.map((e, i) => (
        <div key={i} className={styles.entry}>
          <div className={styles.entryHead}>
            <span className={styles.entryTitle}>
              {e.role}
              {e.role && e.organization ? ", " : ""}
              <span className={styles.entryOrg}>{e.organization}</span>
            </span>
            <span className={styles.entryMeta}>{dateRange(e.startDate, e.endDate)}</span>
          </div>
          {(e.location || e.description) && (
            <div className={styles.entrySub}>
              {hasContent(e.location) && <em className={styles.entryLocation}>{e.location}</em>}
              {hasContent(e.description) && (
                <p className={styles.entryDesc}>{e.description}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function TextLines({ items }: { items: { text: string }[] }) {
  const shown = items.filter((i) => hasContent(i.text));
  if (shown.length === 0) return null;
  return (
    <ul className={styles.bulletList}>
      {shown.map((i, idx) => (
        <li key={idx}>{i.text}</li>
      ))}
    </ul>
  );
}

function EducationList({ entries }: { entries: EducationEntry[] }) {
  const shown = entries.filter((e) => e.institution || e.degree);
  if (shown.length === 0) return null;
  return (
    <div className={styles.entryList}>
      {shown.map((e, i) => (
        <div key={i} className={styles.entry}>
          <div className={styles.entryHead}>
            <span className={styles.entryTitle}>
              {e.degree}
              {e.degree && e.field ? " in " : ""}
              {e.field}
            </span>
            <span className={styles.entryMeta}>{dateRange(e.startDate, e.endDate)}</span>
          </div>
          <div className={styles.entryHead}>
            <span className={styles.entryOrg}>
              {e.institution}
              {e.institution && e.location ? `, ${e.location}` : e.location}
            </span>
            {hasContent(e.gpa) && <span className={styles.entryMeta}>CGPA: {e.gpa}</span>}
          </div>
          {hasContent(e.details) && <p className={styles.entryDesc}>{e.details}</p>}
        </div>
      ))}
    </div>
  );
}

function ProjectList({ entries, compact }: { entries: ProjectEntry[]; compact?: boolean }) {
  const shown = entries.filter((p) => p.title || p.description);
  if (shown.length === 0) return null;
  return (
    <div className={styles.entryList}>
      {shown.map((p, i) => (
        <div key={i} className={styles.entry}>
          <div className={styles.entryHead}>
            <span className={styles.entryTitle}>
              {p.title}
              {p.title && p.organization ? ", " : ""}
              <span className={styles.entryOrg}>{p.organization}</span>
            </span>
            <span className={styles.entryMeta}>{dateRange(p.startDate, p.endDate)}</span>
          </div>
          {(p.link || p.description) && (
            <div className={styles.entrySub}>
              {hasContent(p.link) && (
                <MaybeLink className={styles.entryLink} href={p.link} compact={compact}>
                  {p.link}
                </MaybeLink>
              )}
              {hasContent(p.description) && <p className={styles.entryDesc}>{p.description}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PublicationList({ entries, compact }: { entries: PublicationEntry[]; compact?: boolean }) {
  const shown = entries.filter((p) => p.title || p.venue || p.doi);
  if (shown.length === 0) return null;
  return (
    <div className={styles.entryList}>
      {shown.map((p, i) => (
        <div key={i} className={styles.entry}>
          <div className={styles.entryHead}>
            <span className={styles.entryTitle}>{p.title}</span>
            <span className={styles.entryMeta}>{p.date}</span>
          </div>
          {(p.venue || p.doi) && (
            <div className={styles.entrySub}>
              {hasContent(p.venue) && <em className={styles.entryLocation}>{p.venue}</em>}
              {hasContent(p.doi) && (
                <MaybeLink className={styles.entryLink} href={doiHref(p.doi)} compact={compact}>
                  {p.doi}
                </MaybeLink>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function CVPreview({ data, template, printable, compact }: CVPreviewProps) {
  const { ref: pageRef, zoom } = usePageFitZoom(Boolean(printable));
  const contactBits = [data.email, data.phone, data.location].filter(hasContent);
  const links = [
    ...(hasContent(data.website) ? [{ label: websiteLabel(data.website), url: data.website }] : []),
    ...(hasContent(data.githubUrl) ? [{ label: "GitHub", url: data.githubUrl }] : []),
    ...(hasContent(data.googleScholarUrl) ? [{ label: "Google Scholar", url: data.googleScholarUrl }] : []),
    ...(hasContent(data.orcid) ? [{ label: "ORCID", url: data.orcid }] : []),
    ...(hasContent(data.kaggleUrl) ? [{ label: "Kaggle", url: data.kaggleUrl }] : []),
    ...data.links.filter((l) => hasContent(l.url)),
  ];

  const hasResearch = data.researchExperience.some((e) => e.role || e.organization);
  const hasWork = data.workExperience.some((e) => e.role || e.organization);
  const hasTeaching = data.teachingExperience.some((e) => e.role || e.organization);
  const hasEducation = data.education.some((e) => e.institution || e.degree);
  const hasProjects = data.projects.some((p) => p.title || p.description);
  const hasPublications = data.publications.some((p) => p.title || p.venue || p.doi);
  const hasPresentations = data.presentations.some((p) => hasContent(p.text));
  const hasAwards = data.awards.some((a) => hasContent(a.title));
  const hasSkills = data.skills.some((s) => hasContent(s.category) || hasContent(s.items));
  const hasLanguages = data.languages.some((l) => hasContent(l.text));
  const hasReferences = data.references.some((r) => hasContent(r.name));

  const sectionNodes: Record<SectionKey, React.ReactNode> = {
    researchInterests: hasContent(data.researchInterests) ? (
      <Section title="Research Interests" key="researchInterests">
        <p className={styles.paragraph}>{data.researchInterests}</p>
      </Section>
    ) : null,

    summary: hasContent(data.summary) ? (
      <Section title="Profile" key="summary">
        <p className={styles.paragraph}>{data.summary}</p>
      </Section>
    ) : null,

    education: hasEducation ? (
      <Section title="Education" key="education">
        <EducationList entries={data.education} />
      </Section>
    ) : null,

    researchExperience: hasResearch ? (
      <Section title="Research Experience" key="researchExperience">
        <ExperienceList entries={data.researchExperience} />
      </Section>
    ) : null,

    publications: hasPublications ? (
      <Section title="Publications" key="publications">
        <PublicationList entries={data.publications} compact={compact} />
      </Section>
    ) : null,

    teachingExperience: hasTeaching ? (
      <Section title="Teaching Experience" key="teachingExperience">
        <ExperienceList entries={data.teachingExperience} />
      </Section>
    ) : null,

    workExperience: hasWork ? (
      <Section title="Professional Experience" key="workExperience">
        <ExperienceList entries={data.workExperience} />
      </Section>
    ) : null,

    projects: hasProjects ? (
      <Section title="Projects" key="projects">
        <ProjectList entries={data.projects} compact={compact} />
      </Section>
    ) : null,

    presentations: hasPresentations ? (
      <Section title="Conferences & Presentations" key="presentations">
        <TextLines items={data.presentations} />
      </Section>
    ) : null,

    awards: hasAwards ? (
      <Section title="Awards & Honours" key="awards">
        <div className={styles.entryList}>
          {data.awards
            .filter((a) => hasContent(a.title))
            .map((a, i) => (
              <div key={i} className={styles.entry}>
                <div className={styles.entryHead}>
                  <span className={styles.entryTitle}>
                    {a.title}
                    {a.issuer ? <span className={styles.entryOrg}>, {a.issuer}</span> : null}
                  </span>
                  <span className={styles.entryMeta}>{a.year}</span>
                </div>
                {hasContent(a.description) && (
                  <p className={styles.entryDesc}>{a.description}</p>
                )}
              </div>
            ))}
        </div>
      </Section>
    ) : null,

    skills: hasSkills ? (
      <Section title="Skills" key="skills">
        <dl className={styles.skillList}>
          {data.skills
            .filter((s) => hasContent(s.category) || hasContent(s.items))
            .map((s, i) => (
              <div key={i} className={styles.skillRow}>
                {hasContent(s.category) && <dt className={styles.skillCategory}>{s.category}:</dt>}
                <dd className={styles.skillItems}>{s.items}</dd>
              </div>
            ))}
        </dl>
      </Section>
    ) : null,

    languages: hasLanguages ? (
      <Section title="Languages" key="languages">
        <p className={styles.paragraph}>
          {data.languages
            .filter((l) => hasContent(l.text))
            .map((l) => l.text)
            .join("  \u2022  ")}
        </p>
      </Section>
    ) : null,

    references: hasReferences ? (
      <Section title="References" key="references">
        <div className={styles.refGrid}>
          {data.references
            .filter((r) => hasContent(r.name))
            .map((r, i) => (
              <div key={i} className={styles.refItem}>
                <strong>{r.name}</strong>
                {hasContent(r.affiliation) && <span>{r.affiliation}</span>}
                {hasContent(r.relation) && <span>{r.relation}</span>}
                {hasContent(r.email) && <span className={styles.refEmail}>{r.email}</span>}
              </div>
            ))}
        </div>
      </Section>
    ) : null,
  };

  const order = data.sectionOrder?.length ? data.sectionOrder : DEFAULT_SECTION_ORDER;

  // Show a photo whenever one is set (and not hidden via the toggle), or an
  // empty placeholder slot on the photo-first template so the header layout
  // is obvious before uploading. Europass never shows a photo, full stop.
  const showAvatar =
    templateAllowsPhoto(template) && data.showPhoto && (hasContent(data.photo) || template === "photo");

  return (
    <article
      ref={pageRef}
      className={`${styles.page} ${styles[template]} ${printable ? styles.printable : ""} ${
        compact ? styles.compact : ""
      }`}
      style={printable ? ({ zoom } as React.CSSProperties) : undefined}
      data-cv-print={printable ? "true" : undefined}
    >
      <header className={styles.cvHeader}>
        {showAvatar &&
          (hasContent(data.photo) ? (
            // Data-URL headshot — next/image can't optimize these, and this
            // also needs to render in the print/PDF output as a plain <img>.
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.avatar} src={data.photo} alt={data.fullName || "Profile photo"} />
          ) : (
            <span className={`${styles.avatar} ${styles.avatarPlaceholder}`} aria-hidden="true" />
          ))}
        <div className={styles.headerText}>
          <h1 className={styles.name}>{data.fullName || "Your Name"}</h1>
          {hasContent(data.headline) && <p className={styles.headline}>{data.headline}</p>}
          {contactBits.length > 0 && (
            <p className={styles.contactLine}>{contactBits.join("  \u2022  ")}</p>
          )}
          {links.length > 0 && (
            <p className={styles.contactLine}>
              {links.map((l, i) => (
                <span key={i}>
                  {i > 0 && "  \u2022  "}
                  <MaybeLink href={l.url} compact={compact}>
                    {l.label || l.url}
                  </MaybeLink>
                </span>
              ))}
            </p>
          )}
        </div>
      </header>

      {order.map((key) => sectionNodes[key])}
    </article>
  );
}

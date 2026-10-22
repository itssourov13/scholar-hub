"use client";

import { useEffect, useRef, useState } from "react";
import type { RequiredDocuments } from "@/lib/scholarships-db";
import styles from "./detail.module.css";

/** Generic fallback shown when no AI-tailored list is cached yet (or if
 * generation fails). Kept identical to the original static section. */
const FALLBACK: RequiredDocuments = {
  core: [
    "Valid Passport",
    "Academic Certificates & Transcripts (SSC, HSC, Bachelor's)",
    "Curriculum Vitae (CV) or Resume",
    "Statement of Purpose (SOP) or Motivation Letter",
    "Letters of Recommendation (LOR)",
    "English Proficiency Certificate — IELTS, TOEFL, or PTE",
    "Recent Passport-Sized Photograph",
  ],
  additional: [
    "Medical Certificate",
    "Research Proposal (especially for Master's & PhD)",
    "Work Experience Certificate or Professional Portfolio",
  ],
  note: "A valid passport, academic transcripts, a strong CV, and a well-crafted SOP are usually enough to start applying to most scholarships at the initial stage.",
};

interface Props {
  /** slug or UUID used in the page URL — accepted by the documents API. */
  apiId: string;
  title: string;
  /** DB-cached, AI-generated docs. When null we lazily generate on mount. */
  initial: RequiredDocuments | null;
}

export default function ScholarshipDocuments({ apiId, title, initial }: Props) {
  const [docs, setDocs] = useState<RequiredDocuments | null>(initial);
  const [generating, setGenerating] = useState(false);
  const triggered = useRef(false);

  const isTailored = docs !== null;
  const data = docs ?? FALLBACK;

  useEffect(() => {
    if (initial || triggered.current) return; // already cached, or already asked
    triggered.current = true;
    setGenerating(true);

    const controller = new AbortController();
    fetch(`/api/scholarships/${encodeURIComponent(apiId)}/documents`, {
      method: "POST",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { documents?: RequiredDocuments | null } | null) => {
        if (body?.documents && body.documents.core?.length) {
          setDocs(body.documents);
        }
      })
      .catch(() => {
        /* keep fallback on any error/abort */
      })
      .finally(() => setGenerating(false));

    return () => controller.abort();
  }, [apiId, initial]);

  return (
    <section className={`${styles.docsGuide} ${styles.sectionRule}`}>
      <div className={styles.docsGuideHeader}>
        <span className={styles.eyebrow}>Documentation</span>
        <h2 className={styles.sectionHeading}>Documents required for {title}</h2>
        <p>
          {isTailored
            ? "AI-tailored to this scholarship's level, field, and country. Always confirm the exact list on the official website."
            : generating
              ? "Preparing a list tailored to this scholarship…"
              : "A general guide to documents commonly needed when applying for scholarships abroad."}
        </p>
      </div>

      <div className={styles.docsColumns}>
        <div className={`${styles.docsCard} ${styles.docsCardCore}`}>
          <h3>Core documents</h3>
          <ul className={styles.docsList}>
            {data.core.map((doc) => (
              <li key={doc}>
                <span className={styles.docsDot} />
                {doc}
              </li>
            ))}
          </ul>
        </div>

        {data.additional.length > 0 && (
          <div className={`${styles.docsCard} ${styles.docsCardAdditional}`}>
            <h3>Sometimes required</h3>
            <ul className={styles.docsList}>
              {data.additional.map((doc) => (
                <li key={doc}>
                  <span className={styles.docsDot} />
                  {doc}
                </li>
              ))}
            </ul>

            {data.note && (
              <div className={styles.docsTip}>
                <p>
                  <strong>Pro tip.</strong> {data.note}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

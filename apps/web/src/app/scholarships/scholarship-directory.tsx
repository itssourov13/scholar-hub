import ScholarshipDetailLink from "@/components/scholarships/scholarship-detail-link";
import { getAllPublishedScholarshipCards } from "@/lib/scholarships-db";
import styles from "./scholarship-directory.module.css";

const LEVEL_MAP: Record<string, string> = {
  bachelors: "Bachelor's",
  masters: "Master's",
  phd: "PhD",
  postdoc: "Postdoc",
  any: "Any level",
};

const FUNDING_MAP: Record<string, string> = {
  full: "Full funding",
  partial: "Partial funding",
  tuition_only: "Tuition only",
  stipend: "Stipend only",
  other: "Other",
};

/**
 * Server-rendered, crawlable index of every published scholarship, grouped by
 * country. The interactive card grid above is a client component that fetches
 * its data in the browser, so its links are invisible to crawlers. This
 * directory ensures Googlebot (and AI crawlers) can discover and pass link
 * equity to all 300+ detail pages directly from the hub page — not only via
 * sitemap.xml. It doubles as a useful A-Z index for users.
 */
export default async function ScholarshipDirectory() {
  const scholarships = await getAllPublishedScholarshipCards();
  if (scholarships.length === 0) return null;

  // Group by country (rows already ordered by country, then title)
  const byCountry = new Map<string, typeof scholarships>();
  for (const s of scholarships) {
    const key = s.country || "Other";
    if (!byCountry.has(key)) byCountry.set(key, []);
    byCountry.get(key)!.push(s);
  }
  const countries = [...byCountry.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <section className={styles.directory} aria-label="All scholarships by country">
      {/* Collapsed by default: the links stay in the server-rendered HTML, so
          crawlers still discover every detail page, but visitors only see a
          single expandable row instead of a wall of text. */}
      <details className={styles.disclosure}>
        <summary className={styles.summary}>
          <span>
            <span className={styles.heading}>All scholarships by country</span>
            <span className={styles.summaryMeta}>
              {scholarships.length} scholarships · {countries.length} countries
            </span>
          </span>
          <svg className={styles.chevron} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>

        <div className={styles.body}>
          <p className={styles.intro}>
            Browse the full list of {scholarships.length} international scholarships
            for Bangladeshi students, organised by destination country. Each link
            opens a detailed page with an AI-generated summary, eligibility
            breakdown, deadline, and application tips.
          </p>

          {countries.map((country) => (
            <div key={country} className={styles.countryGroup}>
              <h3 className={styles.countryHeading}>
                Scholarships in {country}{" "}
                <span className={styles.meta}>({byCountry.get(country)!.length})</span>
              </h3>
              <ul className={styles.linkList}>
                {byCountry.get(country)!.map((s) => (
                  <li key={s.id}>
                    <ScholarshipDetailLink href={`/scholarships/${s.slug ?? s.id}`}>
                      {s.title}{" "}
                      <span className={styles.meta}>
                        — {LEVEL_MAP[s.degree_level] ?? s.degree_level},{" "}
                        {FUNDING_MAP[s.funding_type] ?? s.funding_type}
                      </span>
                    </ScholarshipDetailLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

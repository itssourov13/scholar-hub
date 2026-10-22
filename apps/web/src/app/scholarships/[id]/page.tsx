import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import NavbarWithAuth from "@/components/layout/navbar-with-auth";
import ScholarshipDetailLink from "@/components/scholarships/scholarship-detail-link";
import {
  getScholarshipByIdOrSlug,
  getPublishedScholarshipParams,
  getRelatedScholarships,
} from "@/lib/scholarships-db";
import ScholarshipHeroPanelClient from "./scholarship-hero-panel-client";
import ScholarshipDetailClient from "./scholarship-detail-client";
import ScholarshipDocuments from "./scholarship-documents";
import styles from "./detail.module.css";
import { SITE_URL } from "@/lib/site-config";

const BASE_URL = SITE_URL;

// On-demand ISR: prerender every published scholarship at build time and keep
// the HTML until an admin mutation calls revalidateScholarshipPages. Combined
// with generateStaticParams this turns 300+ pages into crawl-friendly static
// HTML without hourly Vercel ISR writes.
export const revalidate = false;
export const dynamicParams = true;

export async function generateStaticParams() {
  return getPublishedScholarshipParams();
}

// UUID pattern — detects legacy UUID-based URLs so we can 301 to slug
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FUNDING_MAP: Record<string, string> = {
  full: "Full funding",
  partial: "Partial funding",
  tuition_only: "Tuition only",
  stipend: "Stipend only",
  other: "Other",
};

const LEVEL_MAP: Record<string, string> = {
  bachelors: "Bachelor's",
  masters: "Master's",
  phd: "PhD",
  postdoc: "Postdoc",
  any: "Any level",
};

type DeadlineTone = "urgent" | "soon" | "normal" | "closed" | "none";

const DEADLINE_TONE_CLASS: Record<DeadlineTone, string> = {
  urgent: styles.deadlineUrgent,
  soon: styles.deadlineSoon,
  normal: styles.deadlineNormal,
  closed: styles.deadlineClosed,
  none: styles.deadlineNone,
};

function parseEligibilityItems(summary: string | null): string[] {
  return (summary ?? "")
    .split(/(?<=\.)\s+(?=[A-Z•])|[•\n]/)
    .map((item) => item.replace(/\.\s*$/, "").trim())
    .filter(Boolean);
}

function parseTipItems(tips: string | null): string[] {
  return (tips ?? "")
    .split(/[•\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDeadlineInfo(d: string | null): { label: string; tone: DeadlineTone } {
  if (!d) return { label: "Open deadline — apply anytime", tone: "none" };

  const date = new Date(d);
  if (isNaN(date.getTime())) return { label: d, tone: "normal" };

  const formatted = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDeadline = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfDeadline.getTime() - startOfToday.getTime()) / 86_400_000
  );

  if (diffDays < 0) return { label: `Closed · ${formatted}`, tone: "closed" };
  if (diffDays === 0) return { label: "Closes today", tone: "urgent" };
  if (diffDays === 1) return { label: "Closes tomorrow", tone: "urgent" };
  if (diffDays <= 7) return { label: `Closes in ${diffDays} days`, tone: "urgent" };
  if (diffDays <= 30)
    return { label: `Closes in ${diffDays} days — ${formatted}`, tone: "soon" };
  return { label: `Deadline: ${formatted}`, tone: "normal" };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ScholarshipDetailPage({ params }: Props) {
  const { id } = await params;

  // Accept both slug and UUID — old UUID links keep working. Shared, memoised
  // fetch (also used by generateMetadata) so Neon is hit once per render.
  const s = await getScholarshipByIdOrSlug(id);
  if (!s) notFound();

  // 301 redirect UUID → slug URL once slug exists
  if (UUID_RE.test(id) && s.slug) {
    redirect(`/scholarships/${s.slug}`);
  }

  const canonicalId = s.slug ?? s.id;
  const pageUrl = `${BASE_URL}/scholarships/${canonicalId}`;
  const levelLabel = LEVEL_MAP[s.degree_level] ?? s.degree_level;
  const fundingLabel = FUNDING_MAP[s.funding_type] ?? s.funding_type;

  const deadlineInfo = getDeadlineInfo(s.deadline);
  const eligibilityItems = parseEligibilityItems(s.eligibility_summary);
  const tipItems = parseTipItems(s.tips);

  const related = await getRelatedScholarships(s.country, s.degree_level, s.id, 6);

  // ── Build FAQ entries from the page's own content. Only questions we can
  // genuinely answer are included, so the visible FAQ and the FAQPage schema
  // stay in sync (a Google requirement) and never render empty answers.
  const faqs: { question: string; answer: string }[] = [];
  faqs.push({
    question: `What does the ${s.title} cover?`,
    answer: `The ${s.title} is a ${fundingLabel.toLowerCase()} ${levelLabel} scholarship for studying in ${s.country}${
      s.deadline ? `, with a deadline of ${deadlineInfo.label.replace(/^Deadline:\s*/, "")}` : ", with an open/rolling deadline"
    }.`,
  });
  if (eligibilityItems.length > 0) {
    faqs.push({
      question: `Who is eligible for the ${s.title}?`,
      answer: eligibilityItems.slice(0, 6).join(". ") + ".",
    });
  }
  if (s.competitiveness) {
    faqs.push({
      question: `How competitive is the ${s.title}?`,
      answer: `This scholarship is rated ${s.competitiveness.toLowerCase()} competitiveness. Review the eligibility checklist and application tips to gauge your fit before applying.`,
    });
  }
  faqs.push({
    question: `What documents do I need to apply for scholarships abroad from Bangladesh?`,
    answer:
      "Most international scholarships require a valid passport, academic certificates and transcripts (SSC, HSC, Bachelor's), a CV/resume, a Statement of Purpose (SOP), letters of recommendation, and an English proficiency certificate (IELTS, TOEFL, or PTE).",
  });

  // ── JSON-LD ─────────────────────────────────────────────────────────────
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Scholarships", item: `${BASE_URL}/scholarships` },
      { "@type": "ListItem", position: 3, name: s.title, item: pageUrl },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  // Scholarship-as-funding schema. schema.org has no dedicated "Scholarship"
  // type, but Grant/MonetaryGrant accurately models a funded study opportunity
  // and helps AI assistants understand the entity.
  const grantSchema = {
    "@context": "https://schema.org",
    "@type": "MonetaryGrant",
    name: s.title,
    description: (s.ai_summary ?? `${fundingLabel} ${levelLabel} scholarship in ${s.country}.`)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500),
    url: pageUrl,
    ...(s.official_url ? { sameAs: s.official_url } : {}),
    funder: {
      "@type": "Organization",
      name: s.country ? `${s.title} provider` : "Scholarship provider",
    },
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "student",
      audienceType: "Bangladeshi students",
    },
    ...(s.deadline ? { applicationDeadline: s.deadline } : {}),
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(grantSchema) }}
      />
      <NavbarWithAuth />

      <main className={styles.main}>
        {/* Breadcrumb — visible + matches BreadcrumbList schema above */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">›</span>
          <Link href="/scholarships">Scholarships</Link>
          <span aria-hidden="true">›</span>
          <span className={styles.breadcrumbCurrent}>{s.title}</span>
        </nav>
        {/* ── Hero ─────────────────────────────────────────────────────────────
            Top row: image (60%) + quick-facts panel (40%).
            Bottom row: title block spans the full hero width so the H1 gets
            maximum room instead of being squeezed into one column.
            H1 and meta are always server-rendered so Google indexes the
            scholarship title on the first crawl. The panel is a client island
            for bookmark / apply buttons.
        ─────────────────────────────────────────────────────────────────────── */}
        <section className={styles.hero}>
          <div className={styles.heroMedia}>
            <Link href="/scholarships" className={styles.mobileBackLink}>
              ← Scholarships
            </Link>

            {s.thumbnail_url && (
              <Image
                src={s.thumbnail_url}
                alt={`${s.title} — ${s.country} scholarship`}
                className={styles.heroImage}
                width={640}
                height={360}
                priority
                sizes="(max-width: 768px) 100vw, 640px"
              />
            )}
          </div>

          {/* Quick-facts panel — bookmark / apply — client only */}
          <ScholarshipHeroPanelClient
            scholarship={{
              id: s.id,
              official_url: s.official_url,
              competitiveness: s.competitiveness,
              tags: s.tags,
            }}
          />

          {/* Title block — full hero width, own row below image + panel */}
          <div className={styles.heroContent}>
            <p className={styles.kicker}>Scholarship detail</p>
            {/* H1 server-rendered — Googlebot sees this on first request */}
            <h1>{s.title}</h1>
            <p className={styles.subtitle}>
              {s.country} · {LEVEL_MAP[s.degree_level] ?? s.degree_level} ·{" "}
              {FUNDING_MAP[s.funding_type] ?? s.funding_type}
            </p>

            <span
              className={`${styles.deadlineBadge} ${DEADLINE_TONE_CLASS[deadlineInfo.tone]}`}
            >
              {deadlineInfo.label}
            </span>
          </div>
        </section>

        {/* ── Official outbound link — server-rendered so Googlebot sees the
            authoritative source link (E-E-A-T) with descriptive anchor text,
            not just the client-only "Apply" button. ─────────────────────── */}
        {s.official_url && (
          <section className={styles.officialLinkCard}>
            <p>
              Applications for the <strong>{s.title}</strong> are handled on the
              official {s.country} scholarship website. Always verify eligibility
              and deadlines there before applying.
            </p>
            <a
              className={styles.officialLinkBtn}
              href={s.official_url}
              target="_blank"
              rel="noopener"
            >
              Visit the official {s.title} page ↗
            </a>
          </section>
        )}

        {/* ── AI summary + AI chat panel (client island) ─────────────── */}
        <ScholarshipDetailClient
          scholarship={{
            id: s.id,
            title: s.title,
            country: s.country,
            degree_level: s.degree_level,
            funding_type: s.funding_type,
            deadline: s.deadline,
            official_url: s.official_url,
            eligibility_summary: s.eligibility_summary,
            competitiveness: s.competitiveness,
            tips: s.tips,
            tags: s.tags,
            ai_summary: s.ai_summary,
          }}
        />

        {/* ── Eligibility checklist + Application timeline — permanent,
            always visible (not tucked behind a tab) since they're what
            students most need to act on. Server-rendered for SEO. ────── */}
        <section className={`${styles.columns} ${styles.sectionRule}`}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.eyebrow}>Requirements</span>
              <h2 className={styles.sectionHeading}>Eligibility checklist</h2>
            </div>
            {eligibilityItems.length > 0 ? (
              <ul className={styles.requirementsList}>
                {eligibilityItems.map((item, i) => (
                  <li key={i}>
                    <span className={styles.checkIcon} aria-hidden="true">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.markdownBody}>Eligibility details coming soon.</p>
            )}
          </div>

          <div className={`${styles.panel} ${styles.panelTips}`}>
            <div className={styles.panelHeader}>
              <span className={styles.eyebrow}>How to apply</span>
              <h2 className={styles.sectionHeading}>Application tips</h2>
            </div>
            {tipItems.length > 0 ? (
              <div className={styles.actionList}>
                {tipItems.map((tip, i) => (
                  <div key={i} className={styles.actionItem}>
                    <span className={styles.actionNumber}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p>{tip}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.markdownBody}>Application tips not yet available.</p>
            )}
          </div>
        </section>

        {/* ── Documents guide — AI-tailored per scholarship, DB-cached.
            Renders cached docs server-side (unique content for SEO); if none
            are cached yet, shows the generic fallback and lazily generates +
            caches a tailored list on first visit. ─────────────────────────── */}
        <ScholarshipDocuments
          apiId={canonicalId}
          title={s.title}
          initial={s.required_documents}
        />

        {/* ── FAQ — server-rendered, mirrors the FAQPage JSON-LD. Great for
            AI Overviews and long-tail "who is eligible / what documents"
            queries. ─────────────────────────────────────────────────────── */}
        <section className={styles.faqSection}>
          <div className={styles.panelHeader}>
            <h2>Frequently asked questions</h2>
          </div>
          {faqs.map((faq, i) => (
            <div key={i} className={styles.faqItem}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </div>
          ))}
        </section>

        {/* ── Related scholarships — internal links spread crawl equity to
            sibling detail pages and keep users on-site. ─────────────────── */}
        {related.length > 0 && (
          <section className={styles.faqSection}>
            <div className={styles.panelHeader}>
              <h2>
                More {levelLabel !== "Any level" ? `${levelLabel} ` : ""}scholarships
                {s.country ? ` in ${s.country}` : ""} & beyond
              </h2>
            </div>
            <div className={styles.relatedGrid}>
              {related.map((r) => (
                <ScholarshipDetailLink
                  key={r.id}
                  href={`/scholarships/${r.slug ?? r.id}`}
                  className={styles.relatedCardLink}
                >
                  <span className={styles.relatedCardCountry}>{r.country}</span>
                  <span className={styles.relatedCardTitle}>{r.title}</span>
                  <span className={styles.relatedCardMeta}>
                    {LEVEL_MAP[r.degree_level] ?? r.degree_level} ·{" "}
                    {FUNDING_MAP[r.funding_type] ?? r.funding_type}
                  </span>
                </ScholarshipDetailLink>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 14 }}>
              <Link href="/scholarships" className={styles.breadcrumbCurrent} style={{ color: "var(--teal-700)" }}>
                Browse all international scholarships for Bangladeshi students →
              </Link>
            </p>
          </section>
        )}

        <div className={styles.aiDisclaimer}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, marginTop: 1 }}
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p>
            The summary, eligibility details, and tips on this page are
            AI-generated and may contain inaccuracies. Always verify information
            on the <strong>official scholarship website</strong> before applying.
          </p>
        </div>
      </main>
    </div>
  );
}

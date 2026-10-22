import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import NavbarWithAuth from "@/components/layout/navbar-with-auth";
import SharedFooter from "@/components/layout/shared-footer";
import { fetchPublishedDbGuides, fetchPublishedGuideBySlug, sortGuides } from "@/lib/guides-db";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GuideAccordion from "./guide-accordion";
import styles from "./guide-detail.module.css";
import { SITE_URL } from "@/lib/site-config";

const BASE = SITE_URL;

// On-demand ISR: prerender each published guide and keep it until
// revalidateGuidePages runs. Guides change rarely, so cached HTML improves
// TTFB/LCP without hourly Vercel ISR writes.
export const revalidate = false;
export const dynamicParams = true;

export async function generateStaticParams() {
  const guides = await fetchPublishedDbGuides();
  return guides.map((g) => ({ slug: g.slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await fetchPublishedGuideBySlug(slug);
  if (!guide) return {};

  const url = `${BASE}/guide/${guide.slug}`;

  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${guide.title} | ScholarHub`,
      description: guide.description,
      url,
      type: "article",
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt,
      tags: guide.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.description,
    },
  };
}

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;

  const guide = await fetchPublishedGuideBySlug(slug);
  if (!guide) notFound();

  /* Related guides: same category, exclude current */
  const related = sortGuides(await fetchPublishedDbGuides())
    .filter((g) => g.slug !== guide.slug && g.category === guide.category)
    .slice(0, 3);

  /* ── JSON-LD: FAQ Schema ── */
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  /* ── JSON-LD: Article Schema ── */
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    author: {
      "@type": "Organization",
      name: "ScholarHub",
      url: BASE,
    },
    publisher: {
      "@type": "Organization",
      name: "ScholarHub",
      url: BASE,
    },
    keywords: guide.tags.join(", "),
    url: `${BASE}/guide/${guide.slug}`,
  };

  /* ── Breadcrumb Schema ── */
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE },
      { "@type": "ListItem", position: 2, name: "Guide", item: `${BASE}/guide` },
      { "@type": "ListItem", position: 3, name: guide.title, item: `${BASE}/guide/${guide.slug}` },
    ],
  };

  const formattedDate = new Date(guide.updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className={styles.page}>
        <NavbarWithAuth />

        <main className={styles.main}>
          {/* Breadcrumb */}
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">›</span>
            <Link href="/guide">Guide</Link>
            <span aria-hidden="true">›</span>
            <span>{guide.title}</span>
          </nav>

          <div className={styles.layout}>
            {/* Article body */}
            <article className={styles.article}>
              {/* Meta header */}
              <header className={styles.articleHeader}>
                <div className={styles.headerMeta}>
                  <span className={styles.categoryBadge}>{guide.category}</span>
                  <span className={styles.updateDate}>Updated {formattedDate}</span>
                </div>
                <h1 className={styles.articleTitle}>{guide.title}</h1>
                <p className={styles.articleIntro}>{guide.intro}</p>

                {/* Tags */}
                <div className={styles.tagList}>
                  {guide.tags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Writer byline — only shown when set on the guide */}
                {guide.writerName && (
                  <div className={styles.authorByline}>
                    <span className={styles.authorName}>{guide.writerName}</span>
                    {guide.writerDesignation && (
                      <span className={styles.authorDesig}>{guide.writerDesignation}</span>
                    )}
                    {guide.publishedAt && (
                      <span className={styles.authorDate}>
                        {new Date(guide.publishedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                )}
              </header>

              {/* Cover image — optional, only shown if provided */}
              {guide.coverImageUrl && (
                <div className={styles.coverImageWrap}>
                  <Image
                    src={guide.coverImageUrl}
                    alt={`Cover image for ${guide.title}`}
                    width={800}
                    height={420}
                    className={styles.coverImage}
                    priority
                    unoptimized
                  />
                </div>
              )}

              {/* Article body — rendered before FAQs */}
              {guide.content && (
                <div className={styles.articleBody}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {guide.content}
                  </ReactMarkdown>
                </div>
              )}

              {/* FAQ count indicator */}
              <div className={styles.faqHeader}>
                <h2 className={styles.faqSectionTitle}>
                  সচরাচর জিজ্ঞাসা
                </h2>
                <span className={styles.faqCount}>{guide.faqs.length}টি প্রশ্ন</span>
              </div>

              {/* Expandable FAQ Accordion */}
              <GuideAccordion faqs={guide.faqs} />

              {/* Bottom CTA */}
              <div className={styles.bottomCta}>
                <p>Have a more specific question?</p>
                <Link href="/chat" className={styles.mentorLink}>
                  Ask the AI Mentor →
                </Link>
              </div>
            </article>

            {/* Sidebar */}
            <aside className={styles.sidebar}>
              <div className={styles.sidebarCard}>
                <p className={styles.sidebarKicker}>Quick navigation</p>
                <ol className={styles.tocList}>
                  {guide.faqs.map((faq, i) => (
                    <li key={i}>
                      <a href={`#faq-${i}`} className={styles.tocLink}>
                        {faq.question}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>

              <div className={styles.sidebarMentorCard}>
                <p className={styles.sidebarMentorTitle}>Still unsure?</p>
                <p className={styles.sidebarMentorText}>
                  Our AI Mentor gives personalised answers based on your specific
                  CGPA, university, and goals.
                </p>
                <Link href="/chat" className={styles.sidebarMentorCta}>
                  Talk to the Mentor
                </Link>
              </div>

              {related.length > 0 && (
                <div className={styles.relatedCard}>
                  <p className={styles.sidebarKicker}>Related guides</p>
                  <ul className={styles.relatedList}>
                    {related.map((g) => (
                      <li key={g.slug}>
                        <Link href={`/guide/${g.slug}`} className={styles.relatedLink}>
                          {g.title}
                          <span className={styles.relatedArrow}>→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={styles.scholarshipsCard}>
                <p className={styles.sidebarKicker}>Ready to apply?</p>
                <p className={styles.scholarshipsText}>
                  Browse scholarships curated for Bangladeshi students.
                </p>
                <Link href="/scholarships" className={styles.scholarshipsLink}>
                  Browse scholarships →
                </Link>
              </div>
            </aside>
          </div>
        </main>
        <SharedFooter />
      </div>
    </>
  );
}

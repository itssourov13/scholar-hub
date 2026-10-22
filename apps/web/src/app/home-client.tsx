"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useT, useLang } from "@/lib/lang-context";
import AppNavbar, { NavAction } from "@/components/layout/app-navbar";
import SharedFooter from "@/components/layout/shared-footer";
import ScholarshipDetailLink from "@/components/scholarships/scholarship-detail-link";
import type { Guide } from "./guide/data/types";
import styles from "./page.module.css";

type ClosingScholarship = {
  id: string;
  slug: string | null;
  title: string;
  country: string;
  deadline: string | null;
  thumbnail_url: string | null;
  funding_type: string | null;
};

export default function HomeClient() {
  const { userId, loading, signOut } = useAuth();
  const router = useRouter();
  const t = useT();

  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ scholarships: 0, countries: 0 });
  const [closingSoon, setClosingSoon] = useState<ClosingScholarship[]>([]);
  const [quickTags, setQuickTags] = useState<string[]>([]);
  const [featuredGuides, setFeaturedGuides] = useState<Guide[]>([]);

  useEffect(() => {
    fetch("/api/guides")
      .then((r) => r.json())
      .then(({ guides: dbGuideRows }: { guides: Record<string, unknown>[] }) => {
        if (!dbGuideRows?.length) return;
        const dbGuides: Guide[] = dbGuideRows.map((g) => ({
          slug: g.slug as string,
          title: g.title as string,
          description: g.description as string,
          category: g.category as Guide["category"],
          tags: (g.tags as string[]) ?? [],
          intro: g.intro as string,
          faqs: Array.isArray(g.faqs) ? g.faqs as Guide["faqs"] : [],
          publishedAt: (g.published_at as string) ?? (g.updated_at as string) ?? "",
          updatedAt: (g.updated_at as string) ?? "",
          coverImageUrl: (g.cover_image_url as string | null) ?? undefined,
        }));
        setFeaturedGuides(dbGuides.slice(0, 3));
      })
      .catch(() => {});

    fetch("/api/scholarships")
      .then((r) => r.json())
      .then(({ scholarships: data }: { scholarships: Record<string, unknown>[] }) => {
        if (!data) return;
        const uniqueCountries = [...new Set(data.map((d) => d.country as string))].filter(Boolean);
        setStats({ scholarships: data.length, countries: uniqueCountries.length });
        setQuickTags(uniqueCountries.slice(0, 4));

        const now = Date.now();
        const horizon = now + 30 * 24 * 60 * 60 * 1000;
        const closing = data
          .filter((s) => {
            if (!s.deadline) return false;
            const t = new Date(s.deadline as string).getTime();
            return !isNaN(t) && t > now && t < horizon;
          })
          .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())
          .slice(0, 4)
          .map((s) => ({
            id: s.id as string,
            slug: (s.slug as string | null) ?? null,
            title: s.title as string,
            country: s.country as string,
            deadline: s.deadline as string | null,
            thumbnail_url: (s.thumbnail_url as string | null) ?? null,
            funding_type: (s.funding_type as string | null) ?? null,
          }));
        setClosingSoon(closing);
      })
      .catch(() => {});
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchQuery.trim();
    const query = term ? `?q=${encodeURIComponent(term)}` : "";
    router.push(`/scholarships${query}`);
  };

  const actions: NavAction[] = loading
    ? []
    : [
        userId
          ? { label: t("nav.signOut"), onClick: signOut }
          : { label: t("nav.signIn"), href: "/auth/login", variant: "ghost" },
        !userId ? { label: t("nav.getStarted"), href: "/auth/signup" } : null,
      ].filter(Boolean) as NavAction[];

  const formatDaysLeft = (deadline: string | null) => {
    if (!deadline) return t("label.open");
    const diff = new Date(deadline).getTime() - Date.now();
    if (isNaN(diff) || diff <= 0) return t("label.closed");
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
    return `${days} ${t("label.daysLeft")}`;
  };

  const formatDeadlineShort = (deadline: string | null) => {
    if (!deadline) return "—";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline.trim())) return "—";
    const d = new Date(deadline);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getUrgencyColor = (deadline: string | null): string => {
    if (!deadline) return "var(--teal-500)";
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days <= 7) return "#e63946";
    if (days <= 14) return "#f4a261";
    return "#2ab673";
  };

  // Stable gradient per country for the fallback thumbnail
  const THUMB_GRADIENTS = [
    "linear-gradient(145deg, #0f3460 0%, #16213e 100%)",
    "linear-gradient(145deg, #1a472a 0%, #0d2b18 100%)",
    "linear-gradient(145deg, #7b2d8b 0%, #4a1460 100%)",
    "linear-gradient(145deg, #7c2929 0%, #4a1414 100%)",
    "linear-gradient(145deg, #0a3d62 0%, #0c2461 100%)",
  ];

  const getThumbGradient = (country: string): string => {
    let h = 0;
    for (let i = 0; i < country.length; i++) h = country.charCodeAt(i) + ((h << 5) - h);
    return THUMB_GRADIENTS[Math.abs(h) % THUMB_GRADIENTS.length];
  };

  const getCountryInitials = (country: string): string =>
    country.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  // ── Render ──
  return (
    <div className={styles.page}>
      <AppNavbar actions={actions} />

      <main className={styles.main}>
        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <p className={styles.kicker}>{t("home.kicker")}</p>
            <h1>{t("home.heroTitle")}</h1>
            <p className={styles.lede}>{t("home.heroCopy")}</p>

            <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
              <div className={styles.searchInputWrap}>
                <svg
                  className={styles.searchIcon}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("home.searchPlaceholder")}
                  className={styles.searchInput}
                  aria-label={t("home.searchAriaLabel")}
                  autoComplete="off"
                />
              </div>
              <button type="submit" className={styles.searchButton}>
                {t("home.searchButton")}
              </button>
            </form>

            <div className={styles.heroBrowseRow}>
              <Link
                href="/scholarships"
                className={styles.browseAllCta}
                aria-label={t("home.browseAll")}
              >
                <span className={styles.browseAllLabel}>{t("home.browseAll")}</span>
                {stats.scholarships > 0 && (
                  <span className={styles.browseAllCount}>{stats.scholarships}</span>
                )}
                <span aria-hidden="true" className={styles.browseAllArrow}>→</span>
              </Link>
            </div>

            {quickTags.length > 0 && (
              <div className={styles.quickTags}>
                <span>{t("home.popular")}</span>
                {quickTags.map((tag) => (
                  <Link key={tag} href={`/scholarships?q=${encodeURIComponent(tag)}`}>
                    {tag}
                  </Link>
                ))}
              </div>
            )}

            <div className={styles.heroAlternative}>
              <p>
                {t("home.notSure")} <Link href="/chat">{t("home.talkToMentor")}</Link>
              </p>
            </div>

            <div className={styles.stats}>
              <div>
                <span className={styles.statValue}>
                  {stats.scholarships > 0 ? stats.scholarships : "—"}
                </span>
                <span className={styles.statLabel}>{t("home.scholarshipsTracked")}</span>
              </div>
              <div>
                <span className={styles.statValue}>
                  {stats.countries > 0 ? stats.countries : "—"}
                </span>
                <span className={styles.statLabel}>{t("home.countriesCovered")}</span>
              </div>
              <div className={styles.statTertiary}>
                <span className={styles.statValue}>24/7</span>
                <span className={styles.statLabel}>{t("home.aiGuidance")}</span>
              </div>
            </div>
          </div>

          {/* Visual: live-styled product preview, built inline so it stays
              perfectly in sync with the real product styling. */}
          <ProductPreview />
        </section>

        {/* ── Workflow (single tight row) ── */}
        <section className={styles.workflowRow} aria-label="How it works">
          <div className={styles.workflowItem}>
            <span className={styles.workflowDot}>1</span>
            <strong>{t("home.step1Label")}</strong>
            <span>{t("home.step1Desc")}</span>
          </div>
          <div className={styles.workflowArrow} aria-hidden="true">
            →
          </div>
          <div className={styles.workflowItem}>
            <span className={styles.workflowDot}>2</span>
            <strong>{t("home.step2Label")}</strong>
            <span>{t("home.step2Desc")}</span>
          </div>
          <div className={styles.workflowArrow} aria-hidden="true">
            →
          </div>
          <div className={styles.workflowItem}>
            <span className={styles.workflowDot}>3</span>
            <strong>{t("home.step3Label")}</strong>
            <span>{t("home.step3Desc")}</span>
          </div>
        </section>

        {/* ── Mentor showcase ── */}
        {/* ── Closing this week (live data) — placed above the mentor showcase
            so visitors see real scholarships before the marketing pitch ── */}
        <section className={styles.closingSection} aria-label="Scholarships closing soon">
          <div className={styles.closingHeader}>
            <div>
              <p className={styles.kicker}>
                <span className={styles.liveDot} aria-hidden="true" />
                {t("home.closingSoon")}
              </p>
              <h2>{t("home.dontMissDeadlines")}</h2>
            </div>
            <Link href="/scholarships?sort=deadline" className={styles.closingMore}>
              {t("home.seeAllScholarships")}
            </Link>
          </div>

          {closingSoon.length === 0 ? (
            <div className={styles.closingEmpty}>
              <p>
                {t("home.nothingClosingPre")}{" "}
                <Link href="/scholarships">{t("home.fullList")}</Link>{" "}
                {t("home.upcomingOpportunities")}
              </p>
            </div>
          ) : (
            <div className={styles.closingGrid}>
              {closingSoon.map((s) => (
                <ScholarshipDetailLink
                  key={s.id}
                  href={`/scholarships/${s.slug ?? s.id}`}
                  className={styles.closingCard}
                >
                  {/* Thumbnail zone */}
                  <div className={styles.closingThumb}>
                    {s.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.thumbnail_url}
                        alt=""
                        className={styles.closingThumbImg}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={styles.closingThumbFallback}
                        style={{ background: getThumbGradient(s.country) }}
                        aria-hidden="true"
                      >
                        <span className={styles.closingThumbInitials}>
                          {getCountryInitials(s.country)}
                        </span>
                      </div>
                    )}
                    {/* Bottom gradient so badge text is always readable */}
                    <div className={styles.closingThumbOverlay} aria-hidden="true" />
                    <span className={styles.closingBadge}>{formatDaysLeft(s.deadline)}</span>
                  </div>

                  {/* Content */}
                  <div className={styles.closingCardBody}>
                    <h3>{s.title}</h3>
                    <p className={styles.closingMeta}>
                      <span>{s.country}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t("home.deadlinePrefix")} {formatDeadlineShort(s.deadline)}</span>
                    </p>
                  </div>

                  {/* Urgency strip */}
                  <div
                    className={styles.closingUrgencyBar}
                    style={{ background: getUrgencyColor(s.deadline) }}
                    aria-hidden="true"
                  />
                </ScholarshipDetailLink>
              ))}
            </div>
          )}
        </section>

        {/* ── Mentor showcase ── */}
        <section className={styles.mentorShowcase}>
          <div className={styles.mentorCopy}>
            <p className={styles.kicker}>{t("home.mentorKicker")}</p>
            <h2>{t("home.mentorTitle")}</h2>
            <p className={styles.sectionSubtext}>{t("home.mentorDesc")}</p>
            <Link href="/chat" className={styles.mentorCta}>
              {t("home.tryMentor")}
            </Link>
          </div>

          <MentorMock />
        </section>

        {/* ── From the Guide ── */}
        <section className={styles.guideTeaser} aria-label="Study abroad guides">
          <div className={styles.guideTeaserHeader}>
            <div>
              <p className={styles.kicker}>{t("home.knowledgeHub")}</p>
              <h2>{t("home.guidesTitle")}</h2>
              <p className={styles.sectionSubtext}>{t("home.guidesDesc")}</p>
            </div>
            <Link href="/guide" className={styles.guideTeaserSeeAll}>
              {t("home.allGuides")}
            </Link>
          </div>
          <div className={styles.guideTeaserGrid}>
            {featuredGuides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guide/${guide.slug}`}
                className={styles.guideTeaserCard}
              >
                <span className={styles.guideTeaserCategory}>{guide.category}</span>
                <h3 className={styles.guideTeaserTitle}>{guide.title}</h3>
                <p className={styles.guideTeaserExcerpt}>{guide.description}</p>
                <span className={styles.guideTeaserCount}>{guide.faqs.length} {t("home.faqsCount")}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SharedFooter />
    </div>
  );
}

// ── Inline visual: hero illustration shown beside the hero copy ──────────────
// The illustration is split into a static base and an animated overlay (the
// paper plane, dashed trail, and location pin). Both SVGs share the exact same
// viewBox, so they stack pixel-perfectly. The overlay's motion lives inside the
// SVG file itself, so a plain <img> is enough for the animation to play.
function ProductPreview() {
  return (
    <div className={styles.previewWrap} aria-hidden="true">
      <div className={styles.heroStack}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-base.svg" alt="" className={styles.heroBase} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-animation.svg" alt="" className={styles.heroAnim} />
      </div>
    </div>
  );
}

// ── Annotated chat mockup for the showcase section ────────────────────────────
function MentorMock() {
  const { lang } = useLang();
  const isBn = lang === "bn";

  return (
    <div className={styles.mentorMock} aria-hidden="true">
      <div className={styles.mentorMockBubbleUser}>
        {isBn
          ? "৩.২ CGPA তে কোন scholarship পাব?"
          : "Which scholarships can I get with a 3.2 CGPA?"}
      </div>

      <div className={styles.mentorMockBubbleAi}>
        {isBn ? (
          <>
            <p>
              <strong>সুখবর</strong> — ৩.২ CGPA দিয়ে অনেক দরজা খোলা আছে:
            </p>
            <p className={styles.mentorMockKey}>তোমার জন্য সেরা options:</p>
            <ul>
              <li><strong>Germany (DAAD):</strong> নির্দিষ্ট minimum নেই, motivation গুরুত্বপূর্ণ</li>
              <li><strong>Japan (MEXT):</strong> ৩.০+ সাধারণত গ্রহণযোগ্য</li>
              <li><strong>Chevening UK:</strong> CGPA নয়, leadership দেখে</li>
              <li><strong>Australia Awards:</strong> ৩.০+ অধিকাংশ field-এ চলে</li>
            </ul>
            <p className={styles.mentorMockTip}>
              💡 ভালো SOP ও IELTS ৬.৫+ কম CGPA-কে compensate করতে পারে।
            </p>
          </>
        ) : (
          <>
            <p>
              <strong>Good news</strong> — 3.2 CGPA opens more doors than most students expect:
            </p>
            <p className={styles.mentorMockKey}>Top options for you:</p>
            <ul>
              <li><strong>Germany (DAAD):</strong> No strict minimum — motivation matters</li>
              <li><strong>Japan (MEXT):</strong> 3.0+ is usually accepted</li>
              <li><strong>Chevening UK:</strong> No published minimum — leadership is key</li>
              <li><strong>Australia Awards:</strong> 3.0+ accepted in most fields</li>
            </ul>
            <p className={styles.mentorMockTip}>
              💡 A strong SOP and IELTS 6.5+ can offset a lower GPA in many programmes.
            </p>
          </>
        )}
      </div>

      <div className={styles.mentorMockAnnotation} data-position="top-right">
        <span className={styles.mentorMockTag}>{isBn ? "সহজ বাংলায়" : "Plain English"}</span>
        <p>{isBn ? "কোনো jargon নেই। Mentor সিনিয়রের মতো বুঝিয়ে বলে।" : "No jargon. The mentor explains eligibility the way a senior would."}</p>
      </div>
      <div className={styles.mentorMockAnnotation} data-position="bottom-left">
        <span className={styles.mentorMockTag}>BD Context</span>
        <p>{isBn ? "BUET, DU, BRAC সব চেনে। Local quirks সহ।" : "Knows local universities, IELTS centers, and visa quirks."}</p>
      </div>
    </div>
  );
}

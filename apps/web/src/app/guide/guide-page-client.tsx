"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useT } from "@/lib/lang-context";
import Pagination from "@/components/ui/pagination";
import type { Guide } from "./data/types";
import styles from "./page.module.css";

const CATEGORY_COLORS: Record<string, string> = {
  Scholarships: "teal",
  Applications: "coral",
  Tests: "sky",
  Destinations: "sand",
  Visa: "purple",
};

// Stable gradient per guide for the fallback thumbnail (when no cover image)
const THUMB_GRADIENTS = [
  "linear-gradient(145deg, #0f3460 0%, #16213e 100%)",
  "linear-gradient(145deg, #1a472a 0%, #0d2b18 100%)",
  "linear-gradient(145deg, #7b2d8b 0%, #4a1460 100%)",
  "linear-gradient(145deg, #7c2929 0%, #4a1414 100%)",
  "linear-gradient(145deg, #0a3d62 0%, #0c2461 100%)",
];

function gradientFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = key.charCodeAt(i) + ((h << 5) - h);
  return THUMB_GRADIENTS[Math.abs(h) % THUMB_GRADIENTS.length];
}

// Fixed display order for the filter chips; only categories that actually
// have guides are shown.
const CATEGORY_ORDER: Guide["category"][] = ["Scholarships", "Applications", "Tests", "Destinations", "Visa"];

const PAGE_SIZE = 12;
const PAGE_CHANGE_EVENT = "guide:pagechange";

// The page number lives in the URL (?page=2) so pages are shareable and the
// back button steps through them. Read via useSyncExternalStore rather than
// useSearchParams so the statically rendered HTML still contains page 1.
function subscribeToUrl(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(PAGE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(PAGE_CHANGE_EVENT, onChange);
  };
}

const getUrlSearch = () => window.location.search;
const getServerSearch = () => "";

export default function GuidePageClient({ guides }: { guides: Guide[] }) {
  const t = useT();
  const gridRef = useRef<HTMLElement>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Guide["category"] | null>(null);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of guides) counts.set(g.category, (counts.get(g.category) ?? 0) + 1);
    return counts;
  }, [guides]);
  const categories = CATEGORY_ORDER.filter((c) => categoryCounts.has(c));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guides.filter((g) => {
      if (category && g.category !== category) return false;
      if (!q) return true;
      return [g.title, g.description, g.category, ...g.tags].join(" ").toLowerCase().includes(q);
    });
  }, [guides, query, category]);

  const urlSearch = useSyncExternalStore(subscribeToUrl, getUrlSearch, getServerSearch);
  const requestedPage = Math.max(1, Number.parseInt(new URLSearchParams(urlSearch).get("page") ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageGuides = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const setUrlPage = (next: number, mode: "push" | "replace") => {
    const params = new URLSearchParams(window.location.search);
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event(PAGE_CHANGE_EVENT));
  };

  const changePage = (next: number) => {
    setUrlPage(next, "push");
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Any search / category change invalidates the current page — back to 1.
  const changeQuery = (value: string) => {
    setQuery(value);
    if (requestedPage !== 1) setUrlPage(1, "replace");
  };

  const changeCategory = (value: Guide["category"] | null) => {
    setCategory(value);
    if (requestedPage !== 1) setUrlPage(1, "replace");
  };

  const clearFilters = () => {
    setQuery("");
    setCategory(null);
    if (requestedPage !== 1) setUrlPage(1, "replace");
  };

  return (
    <main className={styles.main}>
      {/* Header */}
      <section className={styles.header}>
        <h1 className={styles.title}>{t("guide.title")}</h1>
        <p className={styles.subtitle}>{t("guide.subtitle")}</p>
      </section>

      {/* Guide grid */}
      <section className={styles.gridSection} aria-label="All guides" ref={gridRef}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              className={styles.searchInput}
              placeholder={t("guide.searchPlaceholder")}
              value={query}
              onChange={(e) => changeQuery(e.target.value)}
              aria-label={t("guide.searchPlaceholder")}
            />
          </div>
          <div className={styles.chips} role="group" aria-label="Filter by category">
            <button
              type="button"
              className={`${styles.chip} ${category === null ? styles.chipActive : ""}`}
              aria-pressed={category === null}
              onClick={() => changeCategory(null)}
            >
              {t("guide.allCategories")}
              <span className={styles.chipCount}>{guides.length}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.chip} ${category === c ? styles.chipActive : ""}`}
                aria-pressed={category === c}
                onClick={() => changeCategory(category === c ? null : c)}
              >
                {c}
                <span className={styles.chipCount}>{categoryCounts.get(c)}</span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <div className={styles.emptyState}>
            <p>{t("guide.noMatch")}</p>
            <button type="button" className={styles.clearButton} onClick={clearFilters}>
              {t("guide.clearFilters")}
            </button>
          </div>
        )}

        <div className={styles.grid}>
          {pageGuides.map((guide) => {
            const colorKey = CATEGORY_COLORS[guide.category] ?? "teal";
            return (
              <Link
                key={guide.slug}
                href={`/guide/${guide.slug}`}
                className={styles.card}
                aria-label={`${t("guide.readGuide")} ${guide.title}`}
              >
                <div className={styles.cardThumb}>
                  {guide.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={guide.coverImageUrl}
                      alt=""
                      className={styles.cardThumbImg}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className={styles.cardThumbFallback}
                      style={{ background: gradientFor(guide.slug) }}
                      aria-hidden="true"
                    >
                      <span>{guide.category}</span>
                    </div>
                  )}
                </div>
                <div className={styles.cardTop}>
                  <span
                    className={styles.categoryBadge}
                    data-color={colorKey}
                  >
                    {guide.category}
                  </span>
                  <span className={styles.faqCount}>
                    {guide.faqs.length} {t("guide.faqs")}
                  </span>
                </div>
                <h2 className={styles.cardTitle}>{guide.title}</h2>
                <p className={styles.cardExcerpt}>{guide.description}</p>
                <div className={styles.cardFooter}>
                  <div className={styles.tagList}>
                    {guide.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className={styles.readMore}>
                    {t("guide.read")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          totalItems={filtered.length}
          onChange={changePage}
          ariaLabel="Guide pages"
        />
      </section>

      {/* CTA banner */}
      <section className={styles.ctaBanner} aria-label="AI Mentor CTA">
        <div className={styles.ctaInner}>
          <div className={styles.ctaCopy}>
            <span className={styles.ctaKicker}>{t("guide.ctaKicker")}</span>
            <h2 className={styles.ctaTitle}>{t("guide.ctaTitle")}</h2>
          </div>
          <Link href="/chat" className={styles.ctaButton}>
            {t("guide.talkToMentor")}
          </Link>
        </div>
      </section>
    </main>
  );
}

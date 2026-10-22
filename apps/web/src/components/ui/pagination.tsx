import styles from "./pagination.module.css";

/** Page numbers with ellipses: 1 … 4 5 6 … 12 */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

/**
 * "Showing 13–24 of 57" + Prev / numbered / Next pager. Shared by the
 * scholarships and guide listings. Renders nothing when everything fits on
 * one page.
 */
export default function Pagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  onChange,
  ariaLabel = "Pages",
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onChange: (page: number) => void;
  ariaLabel?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className={styles.paginationRow}>
      <p className={styles.pageSummary}>
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} of {totalItems}
      </p>
      <nav className={styles.pagination} aria-label={ariaLabel}>
        <button
          type="button"
          className={styles.pageNav}
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          <span className={styles.pageNavLabel}>Prev</span>
        </button>
        <div className={styles.pageNumbers}>
          {pageList(page, totalPages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className={styles.pageGap} aria-hidden="true">…</span>
            ) : (
              <button
                key={p}
                type="button"
                className={`${styles.pageNumber} ${p === page ? styles.pageNumberActive : ""}`}
                onClick={() => onChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          className={styles.pageNav}
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          <span className={styles.pageNavLabel}>Next</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </nav>
    </div>
  );
}

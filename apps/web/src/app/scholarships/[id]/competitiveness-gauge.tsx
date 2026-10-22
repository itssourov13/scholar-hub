import styles from "./detail.module.css";

const LEVELS = ["Low", "Medium", "High"] as const;

const TONE_CLASS: Record<(typeof LEVELS)[number], string> = {
  Low: styles.gaugeToneLow,
  Medium: styles.gaugeToneMedium,
  High: styles.gaugeToneHigh,
};

interface Props {
  level: string | null;
  /** Tighter spacing/type for use inside the Quick facts sidebar. */
  compact?: boolean;
}

/**
 * Shared "fit" visual — a 3-segment bar that fills up to the scholarship's
 * competitiveness level. Reused in the hero Quick facts panel and the
 * Competitiveness tab so the page has one consistent way of communicating
 * this instead of a plain text pill.
 */
export function CompetitivenessGauge({ level, compact }: Props) {
  if (!level) return null;

  const normalized = level.trim().toLowerCase();
  const activeIndex = LEVELS.findIndex((l) => l.toLowerCase() === normalized);

  // Unrecognized value (not Low/Medium/High) — fall back to a plain label
  // rather than guessing at a fill amount.
  if (activeIndex === -1) {
    return (
      <div className={`${styles.gauge} ${compact ? styles.gaugeCompact : ""}`}>
        <div className={styles.gaugeHeader}>
          <span className={styles.gaugeLabel}>Competitiveness</span>
          <span className={styles.gaugeValue}>{level}</span>
        </div>
      </div>
    );
  }

  const tone = TONE_CLASS[LEVELS[activeIndex]];

  return (
    <div className={`${styles.gauge} ${compact ? styles.gaugeCompact : ""}`}>
      <div className={styles.gaugeHeader}>
        <span className={styles.gaugeLabel}>Competitiveness</span>
        <span className={`${styles.gaugeValue} ${tone}`}>{LEVELS[activeIndex]}</span>
      </div>
      <div className={styles.gaugeTrack}>
        {LEVELS.map((l, i) => (
          <span
            key={l}
            className={`${styles.gaugeSegment} ${i <= activeIndex ? tone : ""}`}
          />
        ))}
      </div>
      {!compact && (
        <div className={styles.gaugeScale}>
          {LEVELS.map((l, i) => (
            <span key={l} className={i === activeIndex ? styles.gaugeScaleActive : ""}>
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

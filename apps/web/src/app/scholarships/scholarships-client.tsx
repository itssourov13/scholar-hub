"use client";

import { Suspense, useEffect, useMemo, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useT, useLang } from "@/lib/lang-context";
import type { TranslationKey } from "@/lib/translations";
import AppNavbar, { NavAction } from "@/components/layout/app-navbar";
import ScholarshipDetailLink from "@/components/scholarships/scholarship-detail-link";
import Pagination from "@/components/ui/pagination";
import { TELEGRAM_URL } from "@/lib/site-config";
import styles from "./scholarships.module.css";

const POPUP_STORAGE_KEY = "scholarhub_telegram_popup_v1";

function TelegramPopup() {
  const { lang } = useLang();
  const [show, setShow] = useState<"hidden" | "entering" | "visible" | "leaving">("hidden");

  useEffect(() => {
    try {
      if (localStorage.getItem(POPUP_STORAGE_KEY)) return;
    } catch { /* ignore */ }

    const timer = setTimeout(() => {
      setShow("entering");
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  // Trigger the CSS enter animation one frame after mounting the DOM node
  useEffect(() => {
    if (show !== "entering") return;
    const id = requestAnimationFrame(() => setShow("visible"));
    return () => cancelAnimationFrame(id);
  }, [show]);

  const dismiss = useCallback(() => {
    setShow("leaving");
    try { localStorage.setItem(POPUP_STORAGE_KEY, "1"); } catch { /* ignore */ }
    // Remove from DOM after transition completes
    setTimeout(() => setShow("hidden"), 320);
  }, []);

  useEffect(() => {
    if (show === "hidden") return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [show, dismiss]);

  if (!TELEGRAM_URL || show === "hidden") return null;

  return (
    <div
      className={`${styles.popupBackdrop} ${show === "visible" ? styles.popupBackdropVisible : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Telegram চ্যানেল জয়েন করুন"
    >
      <div className={`${styles.popupCard} ${show === "visible" ? styles.popupCardVisible : ""}`}>
        <button
          className={styles.popupClose}
          onClick={dismiss}
          aria-label="বন্ধ করুন"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className={styles.popupBody}>
          <p className={styles.popupText}>
            {lang === "en"
              ? "Get regular updates on all scholarships — join now!"
              : "সব স্কলারশিপ এর নিয়মিত আপডেট পেতে জয়েন করুন"}
          </p>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.popupTelegramBtn}
            onClick={dismiss}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            {lang === "en" ? "Join on Telegram" : "Telegram এ জয়েন করুন"}
          </a>
        </div>
      </div>
    </div>
  );
}

type Scholarship = {
  id: string;
  slug: string | null;
  title: string;
  country: string;
  funding_type: string;
  deadline: string | null;
  degree_level: string;
  tags: string[] | null;
  thumbnail_url: string | null;
  competitiveness: string | null;
  is_flagship: boolean;
  is_live: boolean;
  opening_note: string | null;
  summary: string | null;
};

const FUNDING_MAP: Record<string, string> = {
  full: "Full",
  partial: "Partial",
  tuition_only: "Tuition",
  stipend: "Stipend",
  other: "Other",
};

const LEVEL_MAP: Record<string, string> = {
  bachelors: "Bachelors",
  masters: "Masters",
  phd: "PhD",
  postdoc: "Postdoc",
  any: "Any",
};

// Canonical order/subset shown in the Level filter dropdown.
const LEVEL_FILTER_ORDER = ["Any", "Bachelors", "Masters", "PhD"];

// Some records store combined values like "masters | phd" or "masters, phd"
// instead of a single enum value. Split those into their constituent levels
// so they can be matched against the (single-value) Level filter options.
function normalizeLevels(raw: string): string[] {
  if (!raw) return [];
  const tokens = raw
    .toLowerCase()
    .split(/[|,/]|\band\b|\bor\b/i)
    .map((t) => t.trim())
    .filter(Boolean);
  const labels = tokens
    .map((tok) => LEVEL_MAP[tok])
    .filter((label): label is string => Boolean(label));
  if (labels.length) return Array.from(new Set(labels));
  return [LEVEL_MAP[raw.toLowerCase().trim()] ?? raw];
}

const FUNDING_PRIORITY: Record<string, number> = {
  Full: 1, Partial: 2, Tuition: 3, Stipend: 4,
};

const toggleSelection = (value: string, current: string[]) =>
  current.includes(value) ? current.filter((i) => i !== value) : [...current, value];

// ── Dropdown filter component ────────────────────────────────────────────────
function DropdownFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const displayLabel = selected.length > 0 ? `${label} (${selected.length})` : label;

  return (
    <div ref={ref} className={styles.dropdown}>
      <button
        type="button"
        className={`${styles.dropdownTrigger} ${selected.length > 0 ? styles.dropdownTriggerActive : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {displayLabel}
        <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className={styles.dropdownMenu} role="listbox" aria-multiselectable="true" aria-label={label}>
          {options.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.dropdownOption} ${isSelected ? styles.dropdownOptionSelected : ""}`}
                onClick={() => onChange(toggleSelection(opt, selected))}
              >
                <span className={styles.optionCheck}>
                  {isSelected && (
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                      <path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Deadline utilities (module-level — no component state dependency) ─────────
function parseDeadlineDate(d: string): Date | null {
  const s = d.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const date = new Date(s);
    return isNaN(date.getTime()) ? null : date;
  }
  const dmy = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dmy) {
    const date = new Date(`${dmy[2]} ${dmy[1]}, ${dmy[3]}`);
    return isNaN(date.getTime()) ? null : date;
  }
  const mdy = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdy) {
    const date = new Date(`${mdy[1]} ${mdy[2]}, ${mdy[3]}`);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function isClosingSoon(d: string | null): boolean {
  if (!d) return false;
  const date = parseDeadlineDate(d);
  if (!date) return false;
  const diff = date.getTime() - Date.now();
  return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000;
}

function isExpired(d: string | null): boolean {
  if (!d) return false;
  const date = parseDeadlineDate(d);
  return date ? date.getTime() < Date.now() : false;
}

// ── Card presentation helpers ────────────────────────────────────────────────
const FUNDING_PILL: Record<string, string> = {
  full: "Full Funding",
  partial: "Partial Funding",
  tuition_only: "Tuition Only",
  stipend: "Stipend",
  other: "Funding Varies",
};

const LEVEL_CHIP: Record<string, string> = {
  Bachelors: "Bachelor's",
  Masters: "Master's",
  PhD: "PhD",
  Postdoc: "Postdoc",
  Any: "Any Level",
};

// ISO 3166-1 alpha-2 codes for the flag image. Unknown / multi-country
// values ("Europe", "Commonwealth Countries") simply render without a flag.
const COUNTRY_CODE: Record<string, string> = {
  "united kingdom": "gb", uk: "gb", germany: "de", australia: "au", japan: "jp",
  canada: "ca", china: "cn", italy: "it", usa: "us", "united states": "us",
  "new zealand": "nz", "united arab emirates": "ae", uae: "ae", netherlands: "nl",
  turkey: "tr", "türkiye": "tr", switzerland: "ch", hungary: "hu", "south korea": "kr",
  korea: "kr", "saudi arabia": "sa", malaysia: "my", taiwan: "tw", pakistan: "pk",
  singapore: "sg", norway: "no", portugal: "pt", philippines: "ph", malta: "mt",
  lithuania: "lt", thailand: "th", azerbaijan: "az", "czech republic": "cz",
  czechia: "cz", morocco: "ma", slovakia: "sk", mexico: "mx", "hong kong": "hk",
  austria: "at", denmark: "dk", "northern cyprus": "cy", cyprus: "cy", brazil: "br",
  france: "fr", spain: "es", sweden: "se", finland: "fi", ireland: "ie", belgium: "be",
  poland: "pl", india: "in", indonesia: "id", "south africa": "za", russia: "ru",
  egypt: "eg", qatar: "qa", brunei: "bn", romania: "ro", estonia: "ee", latvia: "lv",
  greece: "gr", slovenia: "si", croatia: "hr", iceland: "is", luxembourg: "lu",
  "european union": "eu", europe: "eu",
};

const PROVIDER_RE = /universit|institut|college|school|polytechnic|academy|government|govt|ministry|foundation|commission|council|daad|mext|chevening|fulbright|erasmus|commonwealth|trust|\bkaist\b|\beth\b|\bepfl\b/i;

// Tags that just repeat what the card already shows (country, level, funding,
// provider) or say nothing ("scholarship", "2026") — skipped for the chip row.
const GENERIC_TAG_RE = /^(scholarships?|international( students)?|bangladesh(i)?( students)?|students?|\d{4}|(fully |full |partial(ly)? )?fund(ed|ing)|full scholarship|undergraduate|graduate|postgraduate|masters?|master's|phd|doctoral|bachelors?|bachelor's|postdoc(toral)?|any level|all levels|prestigious|study abroad)$/i;

function scholarshipProvider(s: Scholarship): string | null {
  const fromTag = s.tags?.find((tag) => PROVIDER_RE.test(tag) && tag.length <= 40);
  if (fromTag) return fromTag;
  const fromTitle = s.title.match(/(?:[A-Z][\w'&.-]*\s)*(?:University|Institute|College)(?:\sof(?:\s[A-Z][\w'.-]*)+)?/);
  return fromTitle?.[0].trim() ?? null;
}

function scholarshipChips(s: Scholarship, provider: string | null): string[] {
  const country = s.country.toLowerCase();
  const seen = new Set<string>();
  const chips: string[] = [];
  for (const tag of s.tags ?? []) {
    const key = tag.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (GENERIC_TAG_RE.test(key)) continue;
    if (key === country || COUNTRY_CODE[key]) continue;
    if (provider && key === provider.toLowerCase()) continue;
    chips.push(tag.trim());
    if (chips.length === 3) break;
  }
  return chips;
}

function levelChipLabel(degreeLevel: string): string {
  return normalizeLevels(degreeLevel).map((l) => LEVEL_CHIP[l] ?? l).join(" & ");
}

const DAY_MS = 24 * 60 * 60 * 1000;

type CardStatus = "open" | "upcoming" | "closed";

function deadlineInfo(s: Scholarship, status: CardStatus): { label: string; tone: "soon" | "neutral" | "upcoming" | "closed"; icon: "timer" | "calendar" } {
  if (status === "upcoming") {
    return { label: s.opening_note ? `Opens ${s.opening_note}` : "Opening Soon", tone: "upcoming", icon: "calendar" };
  }
  if (!s.deadline) return { label: "Rolling Deadline", tone: "neutral", icon: "calendar" };
  const date = parseDeadlineDate(s.deadline);
  if (!date) return { label: s.deadline, tone: "neutral", icon: "calendar" };
  const full = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const diff = date.getTime() - Date.now();
  if (status === "closed" || diff < 0) return { label: `Closed ${full}`, tone: "closed", icon: "calendar" };
  if (diff < 60 * DAY_MS) {
    const days = Math.ceil(diff / DAY_MS);
    return { label: days <= 1 ? "Last Day" : `${days} Days Left`, tone: "soon", icon: "timer" };
  }
  return { label: full, tone: "neutral", icon: "calendar" };
}

// ── Scholarship card ─────────────────────────────────────────────────────────
function ScholarshipCard({
  s,
  isBookmarked,
  bookmarking,
  toggleBookmark,
  t,
  status,
}: {
  s: Scholarship;
  isBookmarked: boolean;
  bookmarking: boolean;
  toggleBookmark: (id: string) => void;
  t: (key: TranslationKey) => string;
  status: CardStatus;
}) {
  const href = `/scholarships/${s.slug ?? s.id}`;
  const provider = scholarshipProvider(s);
  const chips = scholarshipChips(s, provider);
  const flagCode = COUNTRY_CODE[s.country.trim().toLowerCase()];
  const deadline = deadlineInfo(s, status);
  const deadlineToneClass = {
    soon: styles.deadlineSoon,
    neutral: styles.deadlineNeutral,
    upcoming: styles.deadlineUpcoming,
    closed: styles.deadlineClosed,
  }[deadline.tone];

  return (
    <article
      className={`${styles.card} ${s.is_flagship ? styles.cardFlagship : ""} ${status === "closed" ? styles.cardClosed : ""}`}
    >
      {/* Stretched link — the whole card is one tap/click target. Interactive
          children (bookmark, CTA) sit above it via z-index. */}
      <ScholarshipDetailLink href={href} className={styles.cardLink} aria-label={`View ${s.title}`} />

      <div className={styles.cardMedia}>
        {s.thumbnail_url ? (
          <Image
            src={s.thumbnail_url}
            alt=""
            className={styles.cardThumb}
            width={640}
            height={360}
            loading="lazy"
            sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
          />
        ) : (
          <div className={styles.cardThumbFallback} aria-hidden="true">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10 12 5 2 10l10 5 10-5Z" />
              <path d="M6 12v5c3 2 9 2 12 0v-5" />
            </svg>
          </div>
        )}
        <div className={styles.mediaShade} aria-hidden="true" />

        <div className={styles.mediaTopLeft}>
          <span className={`${styles.fundingPill} ${s.funding_type === "full" ? styles.fundingPillFull : ""}`}>
            <span className={styles.fundingDot} aria-hidden="true" />
            {FUNDING_PILL[s.funding_type] ?? s.funding_type}
          </span>
          {s.is_flagship && <span className={styles.featuredPill}>{t("scholarships.featured")}</span>}
          {status === "upcoming" && <span className={styles.upcomingPill}>Opening Soon</span>}
          {status === "closed" && <span className={styles.closedPill}>Closed</span>}
        </div>

        <button
          className={`${styles.bookmarkIcon} ${isBookmarked ? styles.bookmarkIconActive : ""}`}
          type="button"
          onClick={() => toggleBookmark(s.id)}
          disabled={bookmarking}
          aria-label={isBookmarked ? `Remove bookmark for ${s.title}` : `Bookmark ${s.title}`}
          aria-pressed={isBookmarked}
          title={isBookmarked ? t("scholarships.bookmarked") : t("scholarships.bookmark")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        <div className={styles.mediaBottom}>
          <span className={styles.mediaCountry}>
            {flagCode && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://flagcdn.com/w40/${flagCode}.png`}
                alt=""
                width={18}
                height={13}
                className={styles.flag}
                loading="lazy"
              />
            )}
            {s.country}
          </span>
          {provider && <span className={styles.mediaProvider}>{provider}</span>}
        </div>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardMetaRow}>
          <span className={styles.levelChip}>{levelChipLabel(s.degree_level)}</span>
          {s.competitiveness && (
            <span className={styles.cardMetaText}>{s.competitiveness} Competition</span>
          )}
        </div>

        <h3 className={styles.cardTitle}>{s.title}</h3>

        {s.summary && <p className={styles.cardSummary}>{s.summary}</p>}

        {chips.length > 0 && (
          <div className={styles.chipRow}>
            {chips.map((chip, i) => (
              <span key={chip} className={i === 0 ? styles.chipHighlight : styles.chip}>
                {i === 0 && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                {chip}
              </span>
            ))}
          </div>
        )}

        <div className={styles.cardFooter}>
          <span className={`${styles.deadlineChip} ${deadlineToneClass}`} title={t("scholarships.deadline")}>
            {deadline.icon === "timer" ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            )}
            <span>{deadline.label}</span>
          </span>
          <ScholarshipDetailLink className={styles.viewButton} href={href}>
            {t("scholarships.viewDetails")}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </ScholarshipDetailLink>
        </div>
      </div>
    </article>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 12;

const TABS: { id: CardStatus; label: string; subtitle: string; dot: "sectionLiveDot" | "sectionUpcomingDot" | "sectionClosedDot" }[] = [
  { id: "open", label: "Open Now", subtitle: "Applications are currently open — apply before the deadline", dot: "sectionLiveDot" },
  { id: "upcoming", label: "Opening Soon", subtitle: "Not yet open — bookmark now and prepare early", dot: "sectionUpcomingDot" },
  { id: "closed", label: "Recently Closed", subtitle: "Deadline passed — these typically recur annually, bookmark to catch next cycle", dot: "sectionClosedDot" },
];

// ── Main page ────────────────────────────────────────────────────────────────
function ScholarshipsContent() {
  const { userId, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedFunding, setSelectedFunding] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("Deadline");
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [bookmarkingId, setBookmarkingId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(0);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/api/scholarships")
      .then((r) => r.json())
      .then(({ scholarships: data }: { scholarships: Scholarship[] }) => {
        setScholarships(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const shouldFocus = searchParams.get("focus") === "1";
    if (shouldFocus) {
      searchInputRef.current?.focus();
    }
  }, [searchParams]);

  useEffect(() => {
    if (!userId) {
      setBookmarkedIds([]);
      return;
    }
    fetch("/api/bookmarks")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { bookmarks?: { scholarship_id: string }[] } | null) => {
        const ids = data?.bookmarks?.map((b) => b.scholarship_id) ?? [];
        setBookmarkedIds(ids);
      })
      .catch(() => setBookmarkedIds([]));
  }, [userId]);

  // Derive filter options from real data
  const countries = useMemo(() => [...new Set(scholarships.map((s) => s.country))].sort(), [scholarships]);
  const fundingOptions = useMemo(() => [...new Set(scholarships.map((s) => FUNDING_MAP[s.funding_type] ?? s.funding_type))].sort(), [scholarships]);
  const levelOptions = useMemo(() => {
    const present = new Set(scholarships.flatMap((s) => normalizeLevels(s.degree_level)));
    return LEVEL_FILTER_ORDER.filter((lvl) => present.has(lvl));
  }, [scholarships]);

  const applyFiltersAndSort = (list: Scholarship[]) => {
    const q = searchTerm.trim().toLowerCase();
    let result = list.filter((s) => {
      if (selectedCountries.length && !selectedCountries.includes(s.country)) return false;
      const fundLabel = FUNDING_MAP[s.funding_type] ?? s.funding_type;
      if (selectedFunding.length && !selectedFunding.includes(fundLabel)) return false;
      const levelLabels = normalizeLevels(s.degree_level);
      if (selectedLevels.length && !selectedLevels.some((l) => levelLabels.includes(l))) return false;
      if (!q) return true;
      const haystack = [s.title, s.country, fundLabel, ...levelLabels, ...(s.tags ?? [])].join(" ").toLowerCase();
      return haystack.includes(q);
    });

    if (sortBy === "Deadline") {
      const now = Date.now();
      const bucket = (d: string | null) => {
        if (!d) return 1;
        const parsed = parseDeadlineDate(d);
        if (!parsed) return 1;
        return parsed.getTime() > now ? 0 : 2;
      };
      result = [...result].sort((a, b) => {
        const ba = bucket(a.deadline), bb = bucket(b.deadline);
        if (ba !== bb) return ba - bb;
        const ta = a.deadline ? (parseDeadlineDate(a.deadline)?.getTime() ?? Infinity) : Infinity;
        const tb = b.deadline ? (parseDeadlineDate(b.deadline)?.getTime() ?? Infinity) : Infinity;
        return ta - tb;
      });
    }
    if (sortBy === "Funding") {
      result = [...result].sort((a, b) => {
        const pa = FUNDING_PRIORITY[FUNDING_MAP[a.funding_type]] ?? 99;
        const pb = FUNDING_PRIORITY[FUNDING_MAP[b.funding_type]] ?? 99;
        return pa - pb;
      });
    }

    result = [...result].sort((a, b) => {
      if (a.is_flagship === b.is_flagship) return 0;
      return a.is_flagship ? -1 : 1;
    });

    return result;
  };

  const filtered = useMemo(() => {
    return applyFiltersAndSort(scholarships);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scholarships, searchTerm, selectedCountries, selectedFunding, selectedLevels, sortBy]);

  // Live = is_live true AND deadline not expired (or no parseable deadline)
  const filteredLive = useMemo(() => applyFiltersAndSort(
    scholarships.filter((s) => s.is_live !== false && !isExpired(s.deadline))
  ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [scholarships, searchTerm, selectedCountries, selectedFunding, selectedLevels, sortBy]);

  const filteredUpcoming = useMemo(() => applyFiltersAndSort(scholarships.filter((s) => s.is_live === false)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [scholarships, searchTerm, selectedCountries, selectedFunding, selectedLevels, sortBy]);

  // Recently closed = is_live true but deadline has passed (within ~90 days)
  const filteredRecentlyClosed = useMemo(() => applyFiltersAndSort(
    scholarships.filter((s) => {
      if (s.is_live === false) return false;
      const date = s.deadline ? parseDeadlineDate(s.deadline) : null;
      if (!date) return false;
      const msSince = Date.now() - date.getTime();
      return msSince > 0 && msSince < 90 * 24 * 60 * 60 * 1000;
    })
  ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [scholarships, searchTerm, selectedCountries, selectedFunding, selectedLevels, sortBy]);

  const emptySuggestions = useMemo(() => {
    const picks = new Set<string>();
    for (const country of countries.slice(0, 2)) picks.add(country);
    if (levelOptions.includes("Masters")) picks.add("Masters");
    if (levelOptions.includes("PhD")) picks.add("PhD");
    if (fundingOptions.includes("Full")) picks.add("Full funding");
    if (fundingOptions.includes("Partial")) picks.add("Partial funding");
    return Array.from(picks).slice(0, 4);
  }, [countries, levelOptions, fundingOptions]);

  const clearFilters = () => {
    setSearchTerm(""); setSelectedCountries([]); setSelectedFunding([]); setSelectedLevels([]); setSortBy("Deadline");
  };

  const hasActiveFilters = searchTerm || selectedCountries.length || selectedFunding.length || selectedLevels.length || sortBy !== "Deadline";



  const closingSoonCount = useMemo(
    () => filteredLive.filter((s) => isClosingSoon(s.deadline)).length,
    [filteredLive],
  );

  // Animated count-up for the snapshot number (total tracked, not just live)
  useEffect(() => {
    const target = filtered.length;
    if (target === displayCount) return;
    const step = Math.max(1, Math.ceil(Math.abs(target - displayCount) / 18));
    const id = window.setInterval(() => {
      setDisplayCount((cur) => {
        if (cur === target) return cur;
        if (cur < target) return Math.min(target, cur + step);
        return Math.max(target, cur - step);
      });
    }, 24);
    return () => window.clearInterval(id);
  }, [filtered.length, displayCount]);

  // ── Tab + page live in the URL (?tab=upcoming&page=2) so pages are
  // shareable and the browser back button steps through them. pushState keeps
  // it client-only — no server round-trip for the static page.
  const tabParam = searchParams.get("tab");
  const tab: CardStatus = tabParam === "upcoming" || tabParam === "closed" ? tabParam : "open";
  const requestedPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const tabLists: Record<CardStatus, Scholarship[]> = {
    open: filteredLive,
    upcoming: filteredUpcoming,
    closed: filteredRecentlyClosed,
  };
  const activeList = tabLists[tab];
  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageItems = activeList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const setUrlState = useCallback((next: { tab?: CardStatus; page?: number }, mode: "push" | "replace") => {
    const params = new URLSearchParams(window.location.search);
    if (next.tab !== undefined) {
      if (next.tab === "open") params.delete("tab");
      else params.set("tab", next.tab);
    }
    if (next.page !== undefined) {
      if (next.page <= 1) params.delete("page");
      else params.set("page", String(next.page));
    }
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const changePage = (p: number) => {
    setUrlState({ page: p }, "push");
    scrollToResults();
  };

  const changeTab = (next: CardStatus) => {
    if (next === tab) return;
    setUrlState({ tab: next, page: 1 }, "push");
  };

  // Any filter/search/sort change invalidates the current page — go back to 1.
  const filterKey = JSON.stringify([searchTerm, selectedCountries, selectedFunding, selectedLevels, sortBy]);
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current === filterKey) return;
    prevFilterKey.current = filterKey;
    if (requestedPage !== 1) setUrlState({ page: 1 }, "replace");
  }, [filterKey, requestedPage, setUrlState]);

  const toggleBookmark = async (id: string) => {
    if (!userId) {
      router.push("/auth/login");
      return;
    }
    setBookmarkingId(id);
    const isBookmarked = bookmarkedIds.includes(id);
    try {
      const res = await fetch("/api/bookmarks", {
        method: isBookmarked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scholarship_id: id }),
      });
      if (res.ok) {
        setBookmarkedIds((prev) =>
          isBookmarked ? prev.filter((item) => item !== id) : [...prev, id]
        );
      }
    } finally {
      setBookmarkingId(null);
    }
  };

  const actions: NavAction[] = [
    userId
      ? { label: t("nav.signOut"), onClick: signOut }
      : { label: t("nav.signIn"), href: "/auth/login", variant: "ghost" },
    !userId ? { label: t("nav.getStarted"), href: "/auth/signup" } : null,
  ].filter(Boolean) as NavAction[];

  return (
    <div className={styles.page}>
      <TelegramPopup />
      <AppNavbar actions={actions} />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>{t("scholarships.kicker")}</p>
            <h1 className={styles.heroTitle}>
              <span className={styles.heroTitleFull}>{t("scholarships.heroTitle")}</span>
              <span className={styles.heroTitleShort} aria-hidden="true">Scholarships</span>
            </h1>
            <p className={styles.subtitle}>{t("scholarships.heroSubtitle")}</p>
          </div>
          <div className={styles.heroPanel}>
            <div className={styles.snapshotHeader}>
              <span className={styles.liveBadge}>
                <span className={styles.liveDot} />
                LIVE
              </span>
              <h3>{t("scholarships.searchSnapshot")}</h3>
            </div>

            {loading ? (
              <p className={styles.snapshotLine}>
                <span className={styles.shimmerBar} aria-hidden="true" />
                <span className={styles.srOnly}>{t("scholarships.loading")}</span>
              </p>
            ) : scholarships.length === 0 ? (
              <p className={styles.snapshotLine}>{t("scholarships.nonePublished")}</p>
            ) : (
              <>
                <div className={styles.snapshotCount} aria-live="polite">
                  <span className={styles.countNumber}>{displayCount}</span>
                  <span className={styles.countLabel}>
                    <span>scholarships tracked</span>
                    <em>{filteredLive.length} open now · {filteredUpcoming.length} opening soon</em>
                  </span>
                </div>
                <div className={styles.snapshotProgress} aria-hidden="true">
                  <span className={styles.snapshotProgressFill} />
                </div>
                {closingSoonCount > 0 && (
                  <p className={styles.urgencyLine}>
                    <span className={styles.urgencyPulse} aria-hidden="true">⚡</span>
                    {closingSoonCount} {t("scholarships.closingIn60")}
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── Compact filter bar ── */}
        <section className={styles.filterBar}>
          {/* Search */}
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t("scholarships.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label={t("scholarships.searchAriaLabel")}
              ref={searchInputRef}
            />
            {searchTerm && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Divider */}
          <div className={styles.barDivider} />

          {/* Dropdown filters */}
          {countries.length > 0 && (
            <DropdownFilter
              label={t("scholarships.country")}
              options={countries}
              selected={selectedCountries}
              onChange={setSelectedCountries}
            />
          )}
          {fundingOptions.length > 0 && (
            <DropdownFilter
              label={t("scholarships.funding")}
              options={fundingOptions}
              selected={selectedFunding}
              onChange={setSelectedFunding}
            />
          )}
          {levelOptions.length > 0 && (
            <DropdownFilter
              label={t("scholarships.level")}
              options={levelOptions}
              selected={selectedLevels}
              onChange={setSelectedLevels}
            />
          )}

          {/* Divider */}
          <div className={styles.barDivider} />

          {/* Sort */}
          <div className={styles.sortWrap}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ color: "var(--ink-500)", flexShrink: 0 }}>
              <path d="M1 3h11M3 6.5h7M5 10h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label={t("scholarships.sortResults")}
            >
              <option value="Best match">{t("scholarships.bestMatch")}</option>
              <option value="Deadline">{t("scholarships.deadline")}</option>
              <option value="Funding">{t("scholarships.funding")}</option>
            </select>
          </div>

          {/* Clear */}
          {hasActiveFilters && (
            <button type="button" className={styles.clearBtn} onClick={clearFilters}>
              {t("scholarships.clear")}
            </button>
          )}
        </section>

        {/* Active filter chips */}
        {(selectedCountries.length > 0 || selectedFunding.length > 0 || selectedLevels.length > 0) && (
          <div className={styles.activeChips}>
            {selectedCountries.map((c) => (
              <span key={c} className={styles.activeChip}>
                {c}
                <button type="button" onClick={() => setSelectedCountries((cur) => cur.filter((v) => v !== c))} aria-label={`Remove ${c}`} className={styles.chipRemove}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true"><path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                </button>
              </span>
            ))}
            {selectedFunding.map((f) => (
              <span key={f} className={styles.activeChip}>
                {f}
                <button type="button" onClick={() => setSelectedFunding((cur) => cur.filter((v) => v !== f))} aria-label={`Remove ${f}`} className={styles.chipRemove}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true"><path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                </button>
              </span>
            ))}
            {selectedLevels.map((l) => (
              <span key={l} className={styles.activeChip}>
                {l}
                <button type="button" onClick={() => setSelectedLevels((cur) => cur.filter((v) => v !== l))} aria-label={`Remove ${l}`} className={styles.chipRemove}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true"><path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                </button>
              </span>
            ))}
            <span className={styles.matchCount}>{filtered.length} {filtered.length !== 1 ? t("scholarships.matches") : t("scholarships.match")}</span>
          </div>
        )}

        {/* ── Results: tabbed by status, paginated ── */}
        <section className={styles.results} ref={resultsRef}>
          <div className={styles.resultsHeader}>
            {/* Mobile-only — replaces the hero snapshot panel (hidden on
                mobile) as the one place the total tracked count still shows.
                Rendered first so it sits above the tabs on mobile. */}
            {!loading && scholarships.length > 0 && (
              <p className={styles.mobileTrackedNote}>
                <span className={styles.mobileTrackedDot} aria-hidden="true" />
                <strong>{displayCount}</strong> scholarships tracked
              </p>
            )}
            <div className={styles.tabs} role="tablist" aria-label="Scholarship status">
              {TABS.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === tb.id}
                  className={`${styles.tab} ${tab === tb.id ? styles.tabActive : ""}`}
                  onClick={() => changeTab(tb.id)}
                >
                  <span className={styles[tb.dot]} aria-hidden="true" />
                  {tb.label}
                  <span className={styles.resultsCount}>{loading ? "–" : tabLists[tb.id].length}</span>
                </button>
              ))}
            </div>
            <p className={styles.sectionSubtitle}>{TABS.find((tb) => tb.id === tab)!.subtitle}</p>
          </div>

          {loading ? (
            <div className={styles.cardGrid} aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.cardSkeleton} />)}
              <span className={styles.srOnly}>{t("scholarships.loading")}</span>
            </div>
          ) : pageItems.length ? (
            <>
              <div className={styles.cardGrid}>
                {pageItems.map((s) => (
                  <ScholarshipCard
                    key={s.id}
                    s={s}
                    isBookmarked={bookmarkedIds.includes(s.id)}
                    bookmarking={bookmarkingId === s.id}
                    toggleBookmark={toggleBookmark}
                    t={t}
                    status={tab}
                  />
                ))}
              </div>
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                pageSize={PAGE_SIZE}
                totalItems={activeList.length}
                onChange={changePage}
                ariaLabel="Scholarship pages"
              />
            </>
          ) : scholarships.length > 0 ? (
            <div className={styles.emptyState}>
              {hasActiveFilters ? (
                <>
                  <p>{t("scholarships.noMatch")}</p>
                  <p className={styles.emptyHint}>{t("scholarships.youMightLike")}</p>
                  {emptySuggestions.length > 0 && (
                    <div className={styles.emptySuggestions}>
                      {emptySuggestions.map((sug) => (
                        <button key={sug} type="button" className={styles.suggestionPill} onClick={() => setSearchTerm(sug)}>{sug}</button>
                      ))}
                    </div>
                  )}
                  <button className={styles.primaryButton} type="button" onClick={clearFilters}>{t("scholarships.resetFilters")}</button>
                </>
              ) : (
                <p>Nothing here right now — check the other tabs.</p>
              )}
            </div>
          ) : null}
        </section>

        {/* Empty state when no results anywhere */}
        {!loading && filteredLive.length === 0 && filteredUpcoming.length === 0 && filteredRecentlyClosed.length === 0 && scholarships.length === 0 && (
          <div className={styles.emptyState}>
            <p>{t("scholarships.nonePublished")}</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ScholarshipsClient() {
  return (
    <Suspense>
      <ScholarshipsContent />
    </Suspense>
  );
}

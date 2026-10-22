/**
 * Lightweight trigram-based similarity matching for scholarships, shared by
 * the manual "check similar" lookup and the bulk-import duplicate guard.
 */

export type ScholarshipRow = {
  id: string;
  title: string;
  country: string;
  status: string;
  slug: string | null;
  official_url: string | null;
};

export type SimilarMatch = {
  id: string;
  title: string;
  country: string;
  status: string;
  slug: string | null;
  similarity: number;
  match_type: "exact_url" | "likely" | "possible";
};

/** Similarity at/above this is treated as a near-certain duplicate (safe to
 * auto-skip without a human glancing at it first). Below this but above the
 * "likely" bar in findSimilarScholarships is surfaced as a warning instead —
 * scholarship titles are heavily templated ("X University ... Government
 * Scholarship 2027") so two genuinely different scholarships can still score
 * 0.65-0.8 on shared boilerplate alone. */
export const STRONG_DUP_SIMILARITY = 0.82;

// Words so common across scholarship listing titles that they add noise
// rather than signal to a similarity score (e.g. "Toyohashi University MEXT
// Japanese Government Scholarship 2027" vs "University of Tokyo Japanese
// Government (MEXT) Scholarship 2027" — nearly identical *except* for the
// one word that actually matters, the host institution).
const TITLE_STOPWORDS = new Set([
  "scholarship", "scholarships", "fellowship", "fellowships", "grant", "grants",
  "award", "awards", "program", "programme", "programs", "programmes",
  "university", "college", "institute", "institution", "academy",
  "international", "government", "national", "global", "world",
  "fully", "funded", "funding", "fund",
  "degree", "degrees", "masters", "master", "bachelor", "bachelors",
  "phd", "doctoral", "postdoc", "postdoctoral", "undergraduate", "graduate",
  "study", "studies", "students", "student", "applications", "application",
  "the", "for", "in", "of", "at", "and", "to", "a", "an", "on",
  "2024", "2025", "2026", "2027", "2028", "2029", "2030",
]);

function significantWords(s: string): string[] {
  const words = s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const filtered = words.filter((w) => !TITLE_STOPWORDS.has(w));
  // Fall back to the unfiltered words if stopword removal wiped everything
  // (e.g. a candidate title that's just "Scholarship 2027").
  return filtered.length > 0 ? filtered : words;
}

function getTrigrams(s: string): Set<string> {
  const normalized = `  ${significantWords(s).join(" ")}  `;
  const trigrams = new Set<string>();
  for (let i = 0; i < normalized.length - 2; i++) {
    trigrams.add(normalized.slice(i, i + 3));
  }
  return trigrams;
}

export function trigramSimilarity(a: string, b: string): number {
  const ta = getTrigrams(a);
  const tb = getTrigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) {
    if (tb.has(t)) shared++;
  }
  return shared / Math.max(ta.size, tb.size);
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    return `${u.hostname}${u.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Finds scholarships similar to the candidate, sorted by relevance (best first). */
export function findSimilarScholarships(
  rows: ScholarshipRow[],
  candidate: { title: string; country?: string; official_url?: string },
): SimilarMatch[] {
  const candidateTitle = candidate.title.trim();
  const candidateCountry = candidate.country?.trim() ?? "";
  const candidateUrl = candidate.official_url?.trim() ?? "";

  const matches: SimilarMatch[] = [];

  for (const row of rows) {
    if (candidateUrl && row.official_url) {
      if (normalizeUrl(candidateUrl) === normalizeUrl(row.official_url)) {
        matches.push({
          id: row.id,
          title: row.title,
          country: row.country,
          status: row.status,
          slug: row.slug,
          similarity: 1.0,
          match_type: "exact_url",
        });
        continue;
      }
    }

    const titleSim = trigramSimilarity(candidateTitle, row.title);
    const countrySim = candidateCountry ? trigramSimilarity(candidateCountry, row.country) : 0;
    const combinedSim = candidateCountry ? titleSim * 0.75 + countrySim * 0.25 : titleSim;

    if (combinedSim >= 0.35) {
      matches.push({
        id: row.id,
        title: row.title,
        country: row.country,
        status: row.status,
        slug: row.slug,
        similarity: combinedSim,
        match_type: combinedSim >= 0.65 ? "likely" : "possible",
      });
    }
  }

  matches.sort((a, b) => {
    if (a.match_type === "exact_url") return -1;
    if (b.match_type === "exact_url") return 1;
    return b.similarity - a.similarity;
  });

  return matches;
}

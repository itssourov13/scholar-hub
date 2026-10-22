import { cache } from "react";
import { sql } from "@/utils/db";

/**
 * Centralised, request-memoised data access for scholarships.
 *
 * Every function here is wrapped in React `cache()` so that a single render
 * pass (e.g. `generateMetadata` + the page component both needing the same
 * scholarship, or `generateStaticParams` + the directory) hits Neon only once.
 * This matters because Neon scales-to-zero: fewer queries = fewer cold starts
 * = lower TTFB = better LCP.
 */

/** AI-generated (and DB-cached) list of documents needed for a scholarship. */
export type RequiredDocuments = {
  core: string[];
  additional: string[];
  note?: string;
};

export type ScholarshipDetail = {
  id: string;
  title: string;
  country: string;
  degree_level: string;
  funding_type: string;
  deadline: string | null;
  official_url: string | null;
  eligibility_summary: string | null;
  competitiveness: string | null;
  tips: string | null;
  tags: string[] | null;
  ai_summary: string | null;
  thumbnail_url: string | null;
  slug: string | null;
  updated_at: string | null;
  required_documents: RequiredDocuments | null;
};

export type ScholarshipCardRow = {
  id: string;
  slug: string | null;
  title: string;
  country: string;
  degree_level: string;
  funding_type: string;
  deadline: string | null;
};

/** Fetch a single published scholarship by slug OR legacy UUID. */
export const getScholarshipByIdOrSlug = cache(
  async (idOrSlug: string): Promise<ScholarshipDetail | null> => {
    try {
      const rows = await sql`
        SELECT
          id, title, country, degree_level, funding_type, deadline,
          official_url, eligibility_summary, competitiveness, tips,
          tags, ai_summary, thumbnail_url, slug, updated_at, required_documents
        FROM scholarships
        WHERE (slug = ${idOrSlug} OR id::text = ${idOrSlug})
          AND status = 'published'
        LIMIT 1
      `;
      return (rows[0] as ScholarshipDetail | undefined) ?? null;
    } catch {
      return null;
    }
  }
);

/** All published scholarship URL segments (slug preferred, UUID fallback). */
export const getPublishedScholarshipParams = cache(async (): Promise<{ id: string }[]> => {
  try {
    const rows = await sql`
      SELECT slug, id::text AS id FROM scholarships WHERE status = 'published'
    `;
    return rows.map((r) => ({
      id: (r.slug as string | null) ?? (r.id as string),
    }));
  } catch {
    // Return empty so the build never fails when the DB is unreachable;
    // pages then render on-demand and stay cached until revalidatePath.
    return [];
  }
});

/** Lightweight list of every published scholarship — for the crawlable directory. */
export const getAllPublishedScholarshipCards = cache(async (): Promise<ScholarshipCardRow[]> => {
  try {
    const rows = await sql`
      SELECT id::text AS id, slug, title, country, degree_level, funding_type, deadline
      FROM scholarships
      WHERE status = 'published'
      ORDER BY country ASC, title ASC
    `;
    return rows as ScholarshipCardRow[];
  } catch {
    return [];
  }
});

/**
 * Related scholarships for internal linking on a detail page.
 * Prefers same country, then falls back to same degree level, excluding self.
 */
export const getRelatedScholarships = cache(
  async (
    country: string,
    degreeLevel: string,
    excludeId: string,
    limit = 6
  ): Promise<ScholarshipCardRow[]> => {
    try {
      const rows = await sql`
        SELECT id::text AS id, slug, title, country, degree_level, funding_type, deadline
        FROM scholarships
        WHERE status = 'published'
          AND id::text <> ${excludeId}
          AND (country = ${country} OR degree_level = ${degreeLevel})
        ORDER BY (country = ${country}) DESC, is_flagship DESC, created_at DESC
        LIMIT ${limit}
      `;
      return rows as ScholarshipCardRow[];
    } catch {
      return [];
    }
  }
);

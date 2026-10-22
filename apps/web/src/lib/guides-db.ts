import { sql } from "@/utils/db";
import type { Guide } from "@/app/guide/data/types";

type DbGuideRow = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[] | null;
  intro: string;
  content?: string | null;
  faqs: unknown;
  published_at: string | null;
  updated_at: string | null;
  created_at?: string | null;
  cover_image_url?: string | null;
  is_pinned?: boolean | null;
  writer_name?: string | null;
  writer_designation?: string | null;
};

function mapDbGuide(g: DbGuideRow): Guide {
  return {
    slug: g.slug,
    title: g.title,
    description: g.description,
    category: g.category as Guide["category"],
    tags: g.tags ?? [],
    intro: g.intro,
    content: g.content ?? undefined,
    faqs: Array.isArray(g.faqs) ? (g.faqs as Guide["faqs"]) : [],
    publishedAt: g.published_at ?? g.updated_at ?? g.created_at ?? "",
    updatedAt: g.updated_at ?? "",
    coverImageUrl: g.cover_image_url ?? undefined,
    isPinned: g.is_pinned ?? false,
    writerName: g.writer_name ?? undefined,
    writerDesignation: g.writer_designation ?? undefined,
  };
}

export async function fetchPublishedDbGuides(): Promise<Guide[]> {
  try {
    const rows = await sql`
      SELECT slug, title, description, category, tags, intro, content, faqs,
             published_at, updated_at, cover_image_url, is_pinned,
             writer_name, writer_designation
      FROM guides
      WHERE status = 'published'
      ORDER BY is_pinned DESC, published_at DESC
    `;
    return (rows as DbGuideRow[]).map(mapDbGuide);
  } catch (err) {
    console.error("[guides-db] fetchPublishedDbGuides failed:", err);
    return [];
  }
}

export async function fetchPublishedGuideBySlug(slug: string): Promise<Guide | undefined> {
  try {
    const rows = await sql`
      SELECT * FROM guides
      WHERE slug = ${slug} AND status = 'published'
      LIMIT 1
    `;
    return rows[0] ? mapDbGuide(rows[0] as DbGuideRow) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Order guides for display: pinned guides first, then the rest in the order
 * returned by the database query. Only guides created via the admin dashboard
 * (i.e. rows in the `guides` table) are ever shown — there are no static/demo
 * guides anymore.
 */
export function sortGuides(dbGuides: Guide[]): Guide[] {
  return [
    ...dbGuides.filter((g) => g.isPinned),
    ...dbGuides.filter((g) => !g.isPinned),
  ];
}

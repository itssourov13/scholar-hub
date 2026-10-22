import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";

interface RouteParams { params: Promise<{ slug: string }> }

/**
 * Fetched by slug rather than filtered out of the full /api/guides list so a
 * guide published seconds ago is reachable immediately: the list route is
 * CDN-cached for 5 minutes (public, s-maxage=300), so a device that hit it
 * just before publish — including the one that just received the push for
 * this very guide — would otherwise see "not found" until that cache clears.
 * A per-slug URL is a fresh cache key, so it's never served stale on first hit.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  const rows = await sql`
    SELECT slug, title, description, category, tags, intro, content, faqs,
           published_at, updated_at, cover_image_url, is_pinned
    FROM guides
    WHERE slug = ${slug} AND status = 'published'
    LIMIT 1
  `;

  if (!rows[0]) return NextResponse.json({ error: "Guide not found" }, { status: 404 });

  return NextResponse.json({ guide: rows[0] }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}

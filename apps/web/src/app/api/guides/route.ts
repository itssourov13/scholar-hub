import { NextResponse } from "next/server";
import { sql } from "@/utils/db";

export async function GET() {
  const rows = await sql`
    SELECT slug, title, description, category, tags, intro, content, faqs,
           published_at, updated_at, cover_image_url, is_pinned
    FROM guides
    WHERE status = 'published'
    ORDER BY is_pinned DESC, published_at DESC
  `;

  return NextResponse.json({ guides: rows }, {
    // s-maxage=300: CDN serves fresh for 5 min.
    // stale-while-revalidate=3600: serve stale for up to 1 hour while revalidating
    // in the background. Tighter than 86400 so new guides appear within the hour.
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}

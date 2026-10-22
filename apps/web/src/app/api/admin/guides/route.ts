import { NextRequest, NextResponse, after } from "next/server";
import { sql } from "@/utils/db";
import { requireAdmin } from "@/utils/api-auth";
import { revalidateGuidePages } from "@/lib/revalidate-guides";
import { pushNewGuide } from "@/lib/push-content";

/** The after() guide push fans out to every device; keep the worker alive. */
export const maxDuration = 300;

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`
    SELECT id, slug, title, category, status, faqs, is_pinned, published_at, updated_at, created_at
    FROM guides
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ guides: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug, title, description, category, tags, intro, content, faqs, status, cover_image_url, writer_name, writer_designation, published_at } = body;

  if (!slug || !title) {
    return NextResponse.json({ error: "slug and title are required" }, { status: 400 });
  }

  try {
    const rows = await sql`
      INSERT INTO guides (slug, title, description, category, tags, intro, content, faqs, status, cover_image_url, writer_name, writer_designation, published_at)
      VALUES (
        ${slug as string},
        ${title as string},
        ${(description as string) ?? ""},
        ${(category as string) ?? "Scholarships"},
        ${JSON.stringify(tags ?? [])}::jsonb,
        ${(intro as string) ?? ""},
        ${(content as string) ?? ""},
        ${JSON.stringify(faqs ?? [])}::jsonb,
        ${(status as string) ?? "draft"},
        ${(cover_image_url as string | null) ?? null},
        ${(writer_name as string | null) ?? null},
        ${(writer_designation as string | null) ?? null},
        ${published_at ? (published_at as string) : status === "published" ? new Date().toISOString() : null}
      )
      RETURNING *
    `;

    if (status === "published" && rows[0]?.slug) {
      revalidateGuidePages(rows[0].slug as string);
      after(() => pushNewGuide(rows[0].id as string));
    }

    return NextResponse.json({ guide: rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      return NextResponse.json({ error: `Slug "${slug}" is already taken.` }, { status: 409 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

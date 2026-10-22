import { NextRequest, NextResponse, after } from "next/server";
import { sql, sqlQuery } from "@/utils/db";
import { requireAdmin } from "@/utils/api-auth";
import { revalidateGuidePages } from "@/lib/revalidate-guides";
import { pushNewGuide } from "@/lib/push-content";

/** The after() guide push fans out to every device; keep the worker alive. */
export const maxDuration = 300;

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await sql`SELECT * FROM guides WHERE id = ${id} LIMIT 1`;

  if (!rows[0]) return NextResponse.json({ error: "Guide not found" }, { status: 404 });
  return NextResponse.json({ guide: rows[0] });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.status === "published") {
    body.published_at = body.published_at ?? new Date().toISOString();
  }

  const allowed = ["slug", "title", "description", "category", "tags", "intro", "content", "faqs", "status", "cover_image_url", "writer_name", "writer_designation", "published_at", "is_pinned"];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const keys = Object.keys(updates);
  const setClauses = keys
    .map((key, i) => {
      if (key === "tags" || key === "faqs") return `${key} = $${i + 2}::jsonb`;
      return `${key} = $${i + 2}`;
    })
    .join(", ");

  for (const key of keys) {
    if ((key === "tags" || key === "faqs") && typeof updates[key] !== "string") {
      updates[key] = JSON.stringify(updates[key]);
    }
  }

  const values = [id, ...Object.values(updates)];
  let rows: Record<string, unknown>[];
  try {
    rows = await sqlQuery(
      `UPDATE guides SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values,
    );
  } catch (err) {
    console.error("PATCH /guides/[id] DB error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  if (!rows[0]) return NextResponse.json({ error: "Guide not found" }, { status: 404 });

  revalidateGuidePages(rows[0].slug as string);

  if (rows[0].status === "published") {
    after(() => pushNewGuide(id));
  }

  return NextResponse.json({ guide: rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await sql`SELECT slug FROM guides WHERE id = ${id} LIMIT 1`;

  await sql`DELETE FROM guides WHERE id = ${id}`;

  if (existing[0]?.slug) revalidateGuidePages(existing[0].slug as string);

  return NextResponse.json({ ok: true });
}

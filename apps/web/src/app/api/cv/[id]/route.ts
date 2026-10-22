import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { getUser } from "@/utils/api-auth";
import { normalizeCV, type CVTemplateId } from "@/lib/cv-types";

const VALID_TEMPLATES: CVTemplateId[] = ["classic", "modern", "europass", "photo"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await sql`
    SELECT id, title, template, data, created_at, updated_at
    FROM public.user_cvs
    WHERE id = ${id} AND user_id = ${auth.userId}
    LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ error: "CV not found" }, { status: 404 });

  return NextResponse.json({ cv: rows[0] });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title =
    typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled CV";
  const template = VALID_TEMPLATES.includes(body.template as CVTemplateId)
    ? (body.template as CVTemplateId)
    : "classic";
  const data = normalizeCV(body.data);

  const rows = await sql`
    UPDATE public.user_cvs SET
      title      = ${title},
      template   = ${template},
      data       = ${JSON.stringify(data)}::jsonb,
      updated_at = NOW()
    WHERE id = ${id} AND user_id = ${auth.userId}
    RETURNING id, title, template, data, created_at, updated_at
  `;
  if (!rows[0]) return NextResponse.json({ error: "CV not found" }, { status: 404 });

  return NextResponse.json({ cv: rows[0] });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await sql`
    DELETE FROM public.user_cvs WHERE id = ${id} AND user_id = ${auth.userId}
  `;

  return NextResponse.json({ ok: true });
}

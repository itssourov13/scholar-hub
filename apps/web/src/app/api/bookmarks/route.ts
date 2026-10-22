import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { getUser } from "@/utils/api-auth";

export async function GET() {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`
    SELECT scholarship_id FROM user_bookmarks
    WHERE user_id = ${auth.userId}
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ bookmarks: rows });
}

export async function POST(req: NextRequest) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { scholarship_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.scholarship_id) {
    return NextResponse.json({ error: "scholarship_id is required" }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO user_bookmarks (user_id, scholarship_id)
      VALUES (${auth.userId}, ${body.scholarship_id})
    `;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      return NextResponse.json({ success: true, already: true });
    }
    return NextResponse.json({ error: "Failed to add bookmark" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { scholarship_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.scholarship_id) {
    return NextResponse.json({ error: "scholarship_id is required" }, { status: 400 });
  }

  await sql`
    DELETE FROM user_bookmarks
    WHERE user_id = ${auth.userId} AND scholarship_id = ${body.scholarship_id}
  `;

  return NextResponse.json({ success: true });
}

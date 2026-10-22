import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { getUser } from "@/utils/api-auth";

type TaskPayload = {
  id?: string;
  title?: string;
  due_date?: string | null;
  status?: "Now" | "Soon" | "Planned" | "Done";
};

export async function GET() {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`
    SELECT id, title, due_date, status, created_at, updated_at
    FROM user_tasks
    WHERE user_id = ${auth.userId}
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ tasks: rows });
}

export async function POST(req: NextRequest) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: TaskPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO user_tasks (user_id, title, due_date, status)
    VALUES (${auth.userId}, ${body.title.trim()}, ${body.due_date ?? null}, ${body.status ?? "Planned"})
    RETURNING id, title, due_date, status, created_at, updated_at
  `;

  return NextResponse.json({ task: rows[0] });
}

export async function PATCH(req: NextRequest) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: TaskPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "Task id is required" }, { status: 400 });

  const rows = await sql`
    UPDATE user_tasks
    SET
      title      = COALESCE(${body.title?.trim() ?? null}, title),
      due_date   = CASE WHEN ${body.due_date !== undefined} THEN ${body.due_date ?? null} ELSE due_date END,
      status     = COALESCE(${body.status ?? null}, status),
      updated_at = NOW()
    WHERE id = ${body.id} AND user_id = ${auth.userId}
    RETURNING id, title, due_date, status, created_at, updated_at
  `;

  return NextResponse.json({ task: rows[0] });
}

export async function DELETE(req: NextRequest) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: TaskPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "Task id is required" }, { status: 400 });

  await sql`
    DELETE FROM user_tasks WHERE id = ${body.id} AND user_id = ${auth.userId}
  `;

  return NextResponse.json({ ok: true });
}

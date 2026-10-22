import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sql } from "@/utils/db";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const anonKey = req.headers.get("x-anon-key");

  if (!userId && !anonKey) {
    return NextResponse.json({ error: "Unauthorized: Missing auth or anon key" }, { status: 401 });
  }

  const rows = userId
    ? await sql`
        SELECT id, title, updated_at, created_at
        FROM chat_sessions
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC LIMIT 20
      `
    : await sql`
        SELECT id, title, updated_at, created_at
        FROM chat_sessions
        WHERE anon_key = ${anonKey} AND user_id IS NULL
        ORDER BY updated_at DESC LIMIT 20
      `;

  return NextResponse.json({ sessions: rows });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  let body: { anonKey?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!userId && !body.anonKey) {
    return NextResponse.json({ error: "Unauthorized: Missing auth or anon key" }, { status: 401 });
  }

  const rows = await sql`
    INSERT INTO chat_sessions (user_id, anon_key, title)
    VALUES (${userId ?? null}, ${userId ? null : (body.anonKey ?? null)}, ${body.title ?? "New conversation"})
    RETURNING id, title, updated_at, created_at
  `;

  return NextResponse.json({ session: rows[0] });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sql } from "@/utils/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { userId } = await auth();
  const anonKey = req.headers.get("x-anon-key");
  const { sessionId } = await params;

  if (!userId && !anonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await sql`
    SELECT user_id, anon_key FROM chat_sessions WHERE id = ${sessionId} LIMIT 1
  `;
  const session = rows[0];

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.user_id) {
    if (!userId || userId !== session.user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  } else {
    if (session.anon_key !== anonKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  await sql`DELETE FROM chat_messages WHERE session_id = ${sessionId}`;
  await sql`DELETE FROM chat_sessions WHERE id = ${sessionId}`;

  return NextResponse.json({ ok: true });
}

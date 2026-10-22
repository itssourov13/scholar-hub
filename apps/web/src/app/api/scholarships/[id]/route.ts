import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await sql`
    SELECT * FROM scholarships
    WHERE id = ${id} AND status = 'published'
    LIMIT 1
  `;

  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ scholarship: rows[0] }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}

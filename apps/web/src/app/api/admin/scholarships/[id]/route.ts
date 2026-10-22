import { NextRequest, NextResponse, after } from "next/server";
import { sql, sqlQuery } from "@/utils/db";
import { requireAdmin } from "@/utils/api-auth";
import { pushNewScholarship } from "@/lib/push-content";
import { revalidateScholarshipPages } from "@/lib/revalidate-scholarships";

/** The after() scholarship push fans out to every device; keep the worker alive. */
export const maxDuration = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await sql`SELECT * FROM scholarships WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ scholarship: rows[0] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Build SET clause dynamically from allowed fields
  const allowed = [
    "title", "country", "degree_level", "funding_type", "deadline",
    "official_url", "raw_description", "status", "is_flagship",
    "ai_summary", "eligibility_summary", "competitiveness", "tips",
    "tags", "thumbnail_url", "thumbnail_prompt",
    "is_live", "opening_note",
    "bangladeshi_eligible", "bangladeshi_eligibility_note",
  ];

  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Pre-process values that need special handling for Neon's HTTP driver:
  // - tags is JSONB: pass as a JSON string with ::jsonb cast (same as enrich route)
  // - booleans: cast explicitly so the driver doesn't mis-serialize them
  const keys = Object.keys(updates);
  const setClauses = keys
    .map((key, i) => {
      if (key === "tags") return `${key} = $${i + 2}::jsonb`;
      if (key === "is_flagship" || key === "is_live" || key === "bangladeshi_eligible") return `${key} = $${i + 2}::boolean`;
      return `${key} = $${i + 2}`;
    })
    .join(", ");

  // Serialise values to match the casts above
  for (const key of keys) {
    if (key === "tags" && Array.isArray(updates[key])) {
      updates[key] = JSON.stringify(updates[key]);
    }
  }

  const values = [id, ...Object.values(updates)];
  let rows: Record<string, unknown>[];
  try {
    rows = await sqlQuery(
      `UPDATE scholarships SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values,
    );
  } catch (err) {
    console.error("PATCH /scholarships/[id] DB error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  if (!rows[0]) return NextResponse.json({ error: "Scholarship not found" }, { status: 404 });

  revalidateScholarshipPages({
    slug: (rows[0].slug as string | null) ?? null,
    id: (rows[0].id as string) ?? id,
  });

  // Fan out after the admin gets their response — the send is claimed inside,
  // so re-saving an already-announced scholarship is a no-op.
  if (rows[0].status === "published") {
    after(() => pushNewScholarship(id));
  }

  return NextResponse.json({ scholarship: rows[0] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await sql`SELECT slug, id FROM scholarships WHERE id = ${id} LIMIT 1`;
  const permanent = new URL(req.url).searchParams.get("permanent") === "true";

  if (permanent) {
    await sql`DELETE FROM scholarships WHERE id = ${id}`;
  } else {
    await sql`UPDATE scholarships SET status = 'archived', updated_at = NOW() WHERE id = ${id}`;
  }

  if (existing[0]) {
    revalidateScholarshipPages({
      slug: (existing[0].slug as string | null) ?? null,
      id: (existing[0].id as string) ?? id,
    });
  }

  return NextResponse.json({ ok: true });
}

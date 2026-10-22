import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { getUser } from "@/utils/api-auth";
import { emptyCV, normalizeCV, type CVTemplateId } from "@/lib/cv-types";

const VALID_TEMPLATES: CVTemplateId[] = ["classic", "modern", "europass", "photo"];

/** List the current user's saved CVs (most recently updated first). */
export async function GET() {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`
    SELECT id, title, template, data, created_at, updated_at
    FROM public.user_cvs
    WHERE user_id = ${auth.userId}
    ORDER BY updated_at DESC
  `;

  return NextResponse.json({ cvs: rows });
}

/** Create a new CV, optionally seeded with `data`/`title`/`template`. */
export async function POST(req: NextRequest) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — create a blank CV
  }

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled CV";
  const template = VALID_TEMPLATES.includes(body.template as CVTemplateId)
    ? (body.template as CVTemplateId)
    : "classic";
  const data = body.data ? normalizeCV(body.data) : emptyCV();

  // Pre-fill contact/basics from the profile if the CV is blank.
  if (!data.fullName && !data.email) {
    const profile = await sql`
      SELECT full_name, portfolio_url, research_interests
      FROM public.profiles WHERE id = ${auth.userId} LIMIT 1
    `;
    if (profile[0]) {
      data.fullName = (profile[0].full_name as string) || "";
      data.website = (profile[0].portfolio_url as string) || "";
      data.researchInterests = (profile[0].research_interests as string) || "";
    }
  }

  const rows = await sql`
    INSERT INTO public.user_cvs (user_id, title, template, data)
    VALUES (${auth.userId}, ${title}, ${template}, ${JSON.stringify(data)}::jsonb)
    RETURNING id, title, template, data, created_at, updated_at
  `;

  return NextResponse.json({ cv: rows[0] }, { status: 201 });
}

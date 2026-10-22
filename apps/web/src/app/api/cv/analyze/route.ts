import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { getUser } from "@/utils/api-auth";
import {
  extractTextFromFile,
  UnsupportedFileError,
  MAX_CV_FILE_BYTES,
} from "@/utils/extract-text";
import { analyzeCVText } from "@/lib/cv-analyze";

// Text extraction (unpdf/mammoth) + the AI call need the Node runtime and a
// longer budget. 60s is the max on Vercel's Hobby plan; raise on Pro if needed.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Return the user's most recent analysis, if any. */
export async function GET() {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`
    SELECT id, source_name, overall_score, result, created_at
    FROM public.cv_analyses
    WHERE user_id = ${auth.userId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return NextResponse.json({ analysis: rows[0] ?? null });
}

/**
 * Analyse an uploaded CV. Accepts either multipart/form-data with a `file`
 * field (PDF/DOCX/TXT) or JSON `{ text }` with pasted CV text.
 */
export async function POST(req: NextRequest) {
  try {
    return await handleAnalyze(req);
  } catch (err) {
    // Last-resort guard so the client always gets JSON instead of a bare 500.
    console.error("CV analyze route crashed:", err);
    return NextResponse.json(
      { error: "Something went wrong analyzing your CV. Please try again." },
      { status: 500 },
    );
  }
}

async function handleAnalyze(req: NextRequest) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let cvText = "";
  let sourceName: string | null = null;

  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }
      if (file.size > MAX_CV_FILE_BYTES) {
        return NextResponse.json({ error: "File is too large (max 8 MB)." }, { status: 400 });
      }
      sourceName = file.name;
      cvText = await extractTextFromFile(file);
    } else {
      const body = (await req.json()) as { text?: unknown };
      cvText = typeof body.text === "string" ? body.text : "";
      sourceName = "Pasted text";
    }
  } catch (err) {
    if (err instanceof UnsupportedFileError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("CV extraction failed:", err);
    return NextResponse.json(
      { error: "Could not read that file. Try a different PDF, or paste the text instead." },
      { status: 400 },
    );
  }

  if (cvText.trim().length < 80) {
    return NextResponse.json(
      { error: "We couldn't find enough text in that CV. Paste the text manually or try another file." },
      { status: 400 },
    );
  }

  let analysis, modelUsed;
  try {
    ({ analysis, modelUsed } = await analyzeCVText(cvText));
  } catch (err) {
    console.error("CV analysis failed:", err);
    return NextResponse.json(
      { error: "The AI analysis failed. Please try again in a moment." },
      { status: 502 },
    );
  }

  try {
    await sql`
      INSERT INTO public.cv_analyses (user_id, source_name, overall_score, result, model_used)
      VALUES (
        ${auth.userId}, ${sourceName}, ${analysis.overallScore},
        ${JSON.stringify(analysis)}::jsonb, ${modelUsed}
      )
    `;
  } catch (err) {
    // Persisting is best-effort — still return the analysis to the user.
    console.error("Failed to store CV analysis:", err);
  }

  return NextResponse.json({ analysis, sourceName });
}

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";

// Benefit-describing words — the sentence that mentions these is the most
// useful one-liner for a listing card ("covers full tuition, stipend of …").
const BENEFIT_RE = /\b(cover|covers|covering|stipend|tuition|allowance|waiver|worth|grant|airfare|insurance|accommodation|monthly|annual)\b/i;

/**
 * Pick a short card blurb from the AI summary. The first sentence usually
 * just restates the title ("The X Scholarship is a fantastic opportunity…"),
 * so prefer the first sentence that actually describes what's funded.
 */
function cardSummary(aiSummary: string | null, eligibility: string | null): string | null {
  const text = (aiSummary || eligibility || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  // Split only at a sentence end followed by a capital, skipping common
  // abbreviations so "approx. HK$…" or "e.g. Tuition" stay in one piece.
  const sentences = text.split(/(?<!\b(?:[Aa]pprox|e\.g|i\.e|etc|incl|vs|No|Dr|St|U\.S|U\.K)\.)(?<=[.!?])\s+(?=[A-Z"“'‘])/);
  const pick = sentences.find((s, i) => i > 0 && BENEFIT_RE.test(s)) ?? sentences[0];
  return pick.length > 220 ? `${pick.slice(0, 217).trimEnd()}…` : pick;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "published";

  const rows = await sql`
    SELECT id, title, country, funding_type, deadline, degree_level,
           tags, thumbnail_url, competitiveness, is_flagship, updated_at, slug,
           is_live, opening_note,
           LEFT(ai_summary, 900) AS ai_summary,
           LEFT(eligibility_summary, 300) AS eligibility_summary
    FROM scholarships
    WHERE status = ${status}
    ORDER BY is_flagship DESC, created_at DESC
  `;

  const scholarships = rows.map(({ ai_summary, eligibility_summary, ...rest }) => ({
    ...rest,
    summary: cardSummary(ai_summary as string | null, eligibility_summary as string | null),
  }));

  return NextResponse.json({ scholarships }, {
    // s-maxage: fresh for 5 min. stale-while-revalidate: for up to 1 day after that,
    // serve the cached copy INSTANTLY while refreshing in the background — so a sleeping
    // Neon DB never makes a visitor wait on a cold start.
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" },
  });
}

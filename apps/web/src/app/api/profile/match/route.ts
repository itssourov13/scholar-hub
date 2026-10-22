import { NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { getUser } from "@/utils/api-auth";
import { generateEmbedding } from "@/lib/nim";

type DocMatch = {
  id: string;
  scholarship_id: string;
  content: string;
  similarity: number;
};

const MATCH_THRESHOLD = 0.4;
const MATCH_COUNT_PER_QUERY = 12;

export async function GET() {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY is not configured" }, { status: 500 });

  const rows = await sql`SELECT * FROM profiles WHERE id = ${auth.userId} LIMIT 1`;
  const profile = rows[0];

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  if (!profile.target_degree && !profile.preferred_countries && !profile.cgpa) {
    return NextResponse.json(
      { error: "Profile is too sparse for matching. Please fill out degree, countries, or CGPA." },
      { status: 400 },
    );
  }

  const countries = (String(profile.preferred_countries ?? ""))
    .split(",")
    .map((c: string) => c.trim())
    .filter(Boolean);

  const buildQuery = (country: string | null): string =>
    [
      `I am looking for a ${profile.target_degree || "higher education"} scholarship.`,
      country ? `My preferred country is: ${country}.` : "",
      profile.cgpa ? `My CGPA is ${profile.cgpa}.` : "",
      profile.work_experience ? `I have ${profile.work_experience} of work experience.` : "",
      profile.goals_notes ? `My goals and notes: ${profile.goals_notes}` : "",
      profile.bsc_major ? `My BSc major/department is ${profile.bsc_major}.` : "",
      profile.university ? `I studied at ${profile.university}.` : "",
      profile.graduation_year ? `I graduated in ${profile.graduation_year}.` : "",
      profile.research_interests ? `My research interests include ${profile.research_interests}.` : "",
      profile.published_papers ? `Published papers: ${profile.published_papers}.` : "",
      profile.ielts_score ? `IELTS/TOEFL score: ${profile.ielts_score}.` : "",
      profile.gre_gmat_score ? `GRE/GMAT score: ${profile.gre_gmat_score}.` : "",
      profile.internships ? `Internships/work roles: ${profile.internships}.` : "",
      profile.portfolio_url ? `Portfolio or profile URL: ${profile.portfolio_url}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

  const queries: string[] =
    countries.length === 0 ? [buildQuery(null)] : countries.map((c: string) => buildQuery(c));

  try {
    const allMatches: DocMatch[] = [];
    await Promise.all(
      queries.map(async (q) => {
        const embedding = await generateEmbedding(q, apiKey, "query");
        const matches = await sql`
          SELECT id, scholarship_id, content, similarity
          FROM match_scholarship_docs(${JSON.stringify(embedding)}::vector, ${MATCH_THRESHOLD}, ${MATCH_COUNT_PER_QUERY})
        ` as DocMatch[];
        for (const row of matches) allMatches.push(row);
      }),
    );

    const bestById = new Map<string, DocMatch>();
    for (const row of allMatches) {
      if (!row.scholarship_id) continue;
      const prev = bestById.get(row.scholarship_id);
      if (!prev || row.similarity > prev.similarity) bestById.set(row.scholarship_id, row);
    }

    const ranked = [...bestById.values()].sort((a, b) => b.similarity - a.similarity);
    const scholarshipIds = ranked.map((r) => r.scholarship_id);

    if (scholarshipIds.length === 0) return NextResponse.json({ matches: [] });

    const scholarships = await sql`
      SELECT id, title, country, degree_level, funding_type, deadline, tags, competitiveness, thumbnail_url
      FROM scholarships
      WHERE id = ANY(${scholarshipIds}::uuid[]) AND status = 'published'
    `;

    const ordered = scholarshipIds
      .map((sid) => scholarships.find((s) => s.id === sid))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    return NextResponse.json({ matches: ordered });
  } catch (err) {
    console.error("Match error:", err);
    return NextResponse.json({ error: "Failed to perform AI match" }, { status: 500 });
  }
}

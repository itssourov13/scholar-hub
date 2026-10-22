import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { sql } from "@/utils/db";
import { getUser } from "@/utils/api-auth";

const PROFILE_FIELDS: { key: string; label: string }[] = [
  { key: "cgpa", label: "CGPA" },
  { key: "target_degree", label: "Target degree level" },
  { key: "preferred_countries", label: "Preferred countries" },
  { key: "bsc_major", label: "Major / department" },
  { key: "university", label: "University" },
  { key: "graduation_year", label: "Graduation year" },
  { key: "ielts_score", label: "IELTS / TOEFL" },
  { key: "work_experience", label: "Work experience" },
  { key: "research_interests", label: "Research interests" },
  { key: "goals_notes", label: "Goals & notes" },
  { key: "gre_gmat_score", label: "GRE / GMAT" },
  { key: "internships", label: "Internships" },
  { key: "published_papers", label: "Published papers" },
  { key: "portfolio_url", label: "Portfolio URL" },
];

type Profile = Record<string, unknown>;

/** How many characters of the mentor's last reply the previews show. */
const PREVIEW_LENGTH = 120;

/**
 * The mentor answers in Markdown, but every consumer of `lastSession.preview`
 * renders it as plain text, so the raw `**bold**` and `[label](url)` syntax
 * would otherwise show through verbatim. Code fences keep their contents —
 * dropping them outright would leave a blank preview for a code-only reply.
 */
function plainTextPreview(markdown: string): string {
  return markdown
    .replace(/```[a-zA-Z0-9]*\n?/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "")
    .replace(/^\s*([-*_]\s*){3,}$/gm, " ")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PREVIEW_LENGTH);
}

type BookmarkScholarship = {
  id: string;
  title: string;
  country: string;
  funding_type: string;
  deadline: string | null;
  thumbnail_url: string | null;
  competitiveness: string | null;
  degree_level: string | null;
};

export async function GET() {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [profileRows, bookmarkRows, lastSessionRows, newCountRows] = await Promise.all([
    sql`SELECT * FROM profiles WHERE id = ${userId} LIMIT 1`,

    sql`
      SELECT ub.created_at, ub.scholarship_id,
             s.id, s.title, s.country, s.funding_type, s.deadline,
             s.thumbnail_url, s.competitiveness, s.degree_level
      FROM user_bookmarks ub
      JOIN scholarships s ON s.id = ub.scholarship_id
      WHERE ub.user_id = ${userId}
      ORDER BY ub.created_at DESC
    `,

    sql`
      SELECT id, title, updated_at
      FROM chat_sessions
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
      LIMIT 1
    `,

    sql`
      SELECT COUNT(*)::int AS cnt
      FROM scholarships
      WHERE status = 'published' AND created_at >= ${sevenDaysAgo}
    `,
  ]);

  const profile = (profileRows[0] ?? null) as Profile | null;

  const filledKeys = new Set<string>();
  if (profile) {
    for (const field of PROFILE_FIELDS) {
      const v = profile[field.key];
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        filledKeys.add(field.key);
      }
    }
  }
  const readiness = Math.round((filledKeys.size / PROFILE_FIELDS.length) * 100);
  const missingFields = PROFILE_FIELDS.filter((f) => !filledKeys.has(f.key)).map((f) => f.label);

  let fullName: string = String(profile?.full_name ?? "").trim();

  if (!fullName) {
    // Profile row is missing/empty — usually because the Clerk `user.created`
    // webhook never ran for this account. Fall back to Clerk's own user data
    // instead of showing a raw user ID, and backfill the profile so this
    // only needs to happen once.
    try {
      const clerkUser = await currentUser();
      const clerkName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim();
      const emailPrefix = clerkUser?.emailAddresses?.[0]?.emailAddress?.split("@")[0];
      fullName = clerkName || emailPrefix || "";

      if (fullName) {
        await sql`
          INSERT INTO profiles (id, full_name)
          VALUES (${userId}, ${fullName})
          ON CONFLICT (id) DO UPDATE SET full_name = ${fullName}
          WHERE profiles.full_name IS NULL OR profiles.full_name = ''
        `;
      }
    } catch (err) {
      console.error("[dashboard] failed to resolve fallback name from Clerk:", err);
    }
  }

  fullName = fullName || "there";

  const bookmarks: BookmarkScholarship[] = bookmarkRows.map((b) => ({
    id: b.id as string,
    title: b.title as string,
    country: b.country as string,
    funding_type: b.funding_type as string,
    deadline: (b.deadline as string | null) ?? null,
    thumbnail_url: (b.thumbnail_url as string | null) ?? null,
    competitiveness: (b.competitiveness as string | null) ?? null,
    degree_level: (b.degree_level as string | null) ?? null,
  }));

  const horizon = now + 30 * 24 * 60 * 60 * 1000;
  const bookmarksClosingSoon = bookmarks
    .filter((s): s is BookmarkScholarship & { deadline: string } => {
      if (!s.deadline) return false;
      const t = new Date(s.deadline).getTime();
      return !isNaN(t) && t > now && t < horizon;
    })
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  const lastSessionRow = lastSessionRows[0] ?? null;
  let lastSession: { id: string; title: string; updated_at: string; preview: string | null } | null = null;

  if (lastSessionRow) {
    const msgRows = await sql`
      SELECT role, content
      FROM chat_messages
      WHERE session_id = ${lastSessionRow.id}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const lastMessage = msgRows[0] ?? null;
    const preview = lastMessage?.content
      ? plainTextPreview(String(lastMessage.content)) || null
      : null;
    lastSession = {
      id: lastSessionRow.id as string,
      title: lastSessionRow.title as string,
      updated_at: lastSessionRow.updated_at as string,
      preview,
    };
  }

  const response = NextResponse.json({
    user: { name: fullName, email: profile?.email ?? null },
    stats: {
      readiness,
      bookmarksCount: bookmarks.length,
      missingFields,
      newScholarshipsCount: (newCountRows[0]?.cnt as number) ?? 0,
    },
    bookmarks,
    bookmarksClosingSoon,
    lastSession,
  });

  response.headers.set("Cache-Control", "private, s-maxage=60, stale-while-revalidate=300");
  return response;
}

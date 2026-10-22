import { NextRequest, NextResponse } from "next/server";
import { sql, sqlQuery } from "@/utils/db";
import {
  CHANNEL_DEADLINES,
  isPushConfigured,
  sendPushToTokens,
  type PushLang,
} from "@/utils/push";

/**
 * Daily deadline reminders for bookmarked scholarships.
 *
 * Triggered by Vercel Cron (see vercel.json), which sends
 * `Authorization: Bearer $CRON_SECRET`. Runs at 03:00 UTC = 09:00 in Dhaka.
 *
 * Every (user, scholarship, milestone) is recorded in push_reminders_sent, so
 * the job is safe to re-run — a retry or a manual invocation won't double-notify.
 */

export const maxDuration = 60;

/** Reminders fire this many days before the deadline. */
const MILESTONES = [7, 3, 1] as const;
type Milestone = (typeof MILESTONES)[number];

/** Users are in Bangladesh (UTC+6); "days left" should match their calendar. */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Local-midnight-to-local-midnight day count, so a deadline "today" is 0. */
function daysUntil(deadline: string, now: number): number | null {
  const parsed = new Date(deadline).getTime();
  if (isNaN(parsed)) return null;

  const startOfDay = (ms: number) =>
    Math.floor((ms + DHAKA_OFFSET_MS) / 86_400_000) * 86_400_000;

  return Math.round((startOfDay(parsed) - startOfDay(now)) / 86_400_000);
}

function copyFor(c: Candidate, lang: PushLang, url: string) {
  const en =
    c.milestone === 1 ? "Deadline tomorrow ⏳" : `Deadline in ${c.milestone} days ⏳`;
  const bn =
    c.milestone === 1 ? "আগামীকাল ডেডলাইন ⏳" : `${c.milestone} দিনে ডেডলাইন ⏳`;
  // Deadlines interrupt; new content doesn't.
  return {
    title: lang === "bn" ? bn : en,
    body: c.title,
    url,
    channelId: CHANNEL_DEADLINES,
    imageUrl: c.thumbnailUrl,
  };
}

interface Candidate {
  userId: string;
  scholarshipId: string;
  title: string;
  thumbnailUrl: string | null;
  milestone: Milestone;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: true, skipped: "push not configured" });
  }

  const now = Date.now();

  const bookmarks = await sql`
    SELECT ub.user_id, s.id AS scholarship_id, s.title, s.deadline, s.thumbnail_url
    FROM user_bookmarks ub
    JOIN scholarships s ON s.id = ub.scholarship_id
    WHERE s.deadline IS NOT NULL
      AND s.status = 'published'
  `;

  // `deadline` is a free-text column (it holds things like "Rolling"), so the
  // date filter has to happen here rather than in SQL.
  const candidates: Candidate[] = [];
  for (const row of bookmarks) {
    const days = daysUntil(row.deadline as string, now);
    if (days === null) continue;
    const milestone = MILESTONES.find((m) => m === days);
    if (!milestone) continue;
    candidates.push({
      userId: row.user_id as string,
      scholarshipId: row.scholarship_id as string,
      title: row.title as string,
      thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
      milestone,
    });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, considered: 0, sent: 0 });
  }

  const alreadySent = await sqlQuery<{ user_id: string; scholarship_id: string; milestone: string }>(
    `SELECT user_id, scholarship_id, milestone FROM push_reminders_sent
     WHERE user_id = ANY($1::text[]) AND scholarship_id = ANY($2::uuid[])`,
    [
      [...new Set(candidates.map((c) => c.userId))],
      [...new Set(candidates.map((c) => c.scholarshipId))],
    ],
  );
  const sentKeys = new Set(
    alreadySent.map((r) => `${r.user_id}|${r.scholarship_id}|${r.milestone}`),
  );

  const pending = candidates.filter(
    (c) => !sentKeys.has(`${c.userId}|${c.scholarshipId}|${c.milestone}d`),
  );
  if (pending.length === 0) {
    return NextResponse.json({ ok: true, considered: candidates.length, sent: 0 });
  }

  const tokenRows = await sqlQuery<{ user_id: string; token: string; lang: string }>(
    `SELECT user_id, token, lang FROM push_tokens
     WHERE disabled_at IS NULL AND user_id = ANY($1::text[])`,
    [[...new Set(pending.map((c) => c.userId))]],
  );

  const devices = new Map<string, { token: string; lang: PushLang }[]>();
  for (const row of tokenRows) {
    const list = devices.get(row.user_id) ?? [];
    list.push({ token: row.token, lang: row.lang === "bn" ? "bn" : "en" });
    devices.set(row.user_id, list);
  }

  let sent = 0;
  const delivered: Candidate[] = [];

  for (const c of pending) {
    const userDevices = devices.get(c.userId);
    // No device registered: record it anyway so we don't reconsider this
    // milestone forever once they do install.
    if (!userDevices?.length) {
      delivered.push(c);
      continue;
    }

    const url = `/scholarship/${c.scholarshipId}`;
    for (const lang of ["en", "bn"] as const) {
      const tokens = userDevices.filter((d) => d.lang === lang).map((d) => d.token);
      if (tokens.length === 0) continue;
      const result = await sendPushToTokens(tokens, copyFor(c, lang, url));
      sent += result.sent;
    }
    delivered.push(c);
  }

  await sqlQuery(
    `INSERT INTO push_reminders_sent (user_id, scholarship_id, milestone)
     SELECT * FROM UNNEST($1::text[], $2::uuid[], $3::text[])
     ON CONFLICT DO NOTHING`,
    [
      delivered.map((c) => c.userId),
      delivered.map((c) => c.scholarshipId),
      delivered.map((c) => `${c.milestone}d`),
    ],
  );

  return NextResponse.json({
    ok: true,
    considered: candidates.length,
    reminders: delivered.length,
    sent,
  });
}

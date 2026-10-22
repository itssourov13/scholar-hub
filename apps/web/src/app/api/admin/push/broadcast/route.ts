import { NextRequest, NextResponse, after } from "next/server";
import { requireAdmin } from "@/utils/api-auth";
import {
  broadcastLocalizedPush,
  getPushTokenStats,
  isPushConfigured,
} from "@/utils/push";

/**
 * One-off custom push announcement, admin-triggered.
 *
 * Unlike pushNewScholarship/pushNewGuide (fired automatically on publish) or
 * push-digest (deadline reminders on a cron), this has no dedup/claim record —
 * it's meant for occasional manual broadcasts (e.g. "AI Mentor is faster now"),
 * so every submit sends. The admin UI is the only guard against double-sends.
 *
 * Fan-out is started with `after()` so a proxy timeout (Cloudflare's 100s)
 * cannot abort the remaining FCM calls. The handler still awaits the same
 * promise so the admin UI can show sent/failed counts when the send finishes
 * in time.
 */

export const maxDuration = 300;

const MAX_TITLE = 80;
const MAX_BODY = 200;
const MAX_IMAGE_URL = 2000;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** FCM only fetches https images; anything else is dropped so the text still goes out. */
function httpsImageUrl(value: unknown): string | null {
  const url = clean(value, MAX_IMAGE_URL);
  return url.startsWith("https://") ? url : null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stats = await getPushTokenStats();
  return NextResponse.json({ configured: isPushConfigured(), ...stats });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push is not configured on this deployment" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const titleEn = clean(body.titleEn, MAX_TITLE);
  const bodyEn = clean(body.bodyEn, MAX_BODY);
  const titleBn = clean(body.titleBn, MAX_TITLE);
  const bodyBn = clean(body.bodyBn, MAX_BODY);
  const url = clean(body.url, 200) || "/chat";
  const imageUrl = httpsImageUrl(body.imageUrl);
  const includeDisabled = body.includeDisabled === true;

  if (!titleEn || !bodyEn || !titleBn || !bodyBn) {
    return NextResponse.json(
      { error: "English and Bangla title + body are all required" },
      { status: 400 },
    );
  }

  const resultPromise = broadcastLocalizedPush(
    {
      en: { title: titleEn, body: bodyEn, url, imageUrl },
      bn: { title: titleBn, body: bodyBn, url, imageUrl },
    },
    { includeDisabled },
  );

  after(() =>
    resultPromise.then(
      (result) => console.log(`[push] manual broadcast by ${auth.userId}:`, result),
      (err) => console.error(`[push] manual broadcast by ${auth.userId} failed:`, err),
    ),
  );

  const result = await resultPromise;
  return NextResponse.json({ ok: true, ...result });
}

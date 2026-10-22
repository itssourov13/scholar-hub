import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/utils/db";
import { getUser } from "@/utils/api-auth";

/**
 * Device push-token registry.
 *
 * The app calls POST on every launch: FCM rotates tokens on its own schedule,
 * and re-registering is how we learn about it. Registration requires auth, so
 * the token table can't be spammed by anonymous callers, and it matches the
 * app's existing rule that notifications only start once signed in.
 */

const MAX_TOKEN_LENGTH = 4096;

function readToken(body: Record<string, unknown>): string | null {
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  return token;
}

export async function POST(req: NextRequest) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = readToken(body);
  if (!token) return NextResponse.json({ error: "Missing or invalid token" }, { status: 400 });

  const platform = body.platform === "ios" ? "ios" : "android";
  const lang = body.lang === "bn" ? "bn" : "en";
  const appVersion =
    typeof body.appVersion === "string" ? body.appVersion.slice(0, 32) : null;

  try {
    // Profile rows are created by the Clerk user.created webhook, which often
    // loses the race against this request on first sign-in. push_tokens.user_id
    // FKs to profiles(id), so a missing profile used to 500 and the device
    // never registered — until the next cold start, if they ever came back.
    await sql`
      INSERT INTO profiles (id)
      VALUES (${auth.userId})
      ON CONFLICT (id) DO NOTHING
    `;

    // The same physical device can move between accounts, so a conflicting
    // token is re-pointed at the current user rather than rejected. Re-enabling
    // matters too: a token FCM previously reported as dead can come back after
    // a reinstall.
    await sql`
      INSERT INTO push_tokens (token, user_id, platform, lang, app_version)
      VALUES (${token}, ${auth.userId}, ${platform}, ${lang}, ${appVersion})
      ON CONFLICT (token) DO UPDATE SET
        user_id      = EXCLUDED.user_id,
        platform     = EXCLUDED.platform,
        lang         = EXCLUDED.lang,
        app_version  = EXCLUDED.app_version,
        last_seen_at = NOW(),
        disabled_at  = NULL
    `;
  } catch (err) {
    console.error("POST /api/push/register DB error:", err);
    return NextResponse.json({ error: "Could not register token" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Called on sign-out so a shared device stops receiving the old user's pushes. */
export async function DELETE(req: NextRequest) {
  const auth = await getUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = readToken(body);
  if (!token) return NextResponse.json({ error: "Missing or invalid token" }, { status: 400 });

  try {
    await sql`
      UPDATE push_tokens SET disabled_at = NOW()
      WHERE token = ${token} AND user_id = ${auth.userId}
    `;
  } catch (err) {
    console.error("DELETE /api/push/register DB error:", err);
    return NextResponse.json({ error: "Could not unregister token" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

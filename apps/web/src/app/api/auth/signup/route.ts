import { NextResponse } from "next/server";

/**
 * Legacy endpoint — sign-up is now handled entirely by Clerk on the client.
 * Kept as a 410 Gone so any stale bookmarks/clients get a clear error.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Sign-up is now handled by Clerk. Use the /auth/signup page." },
    { status: 410 },
  );
}

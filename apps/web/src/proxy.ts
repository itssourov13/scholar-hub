import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL;

/** Homepage paths only — don't force-redirect deeper pages. */
const ANDROID_REDIRECT_PATHS = new Set(["/", "/bn"]);

/**
 * Android phones (and tablets) — exclude obvious crawlers so Googlebot
 * mobile still indexes the web homepage.
 */
function shouldRedirectAndroidToPlayStore(request: NextRequest): boolean {
  const { pathname, searchParams } = request.nextUrl;

  if (!ANDROID_REDIRECT_PATHS.has(pathname)) return false;
  // Escape hatch: /?web=1 or /bn?web=1 keeps the website.
  if (searchParams.has("web")) return false;

  const ua = request.headers.get("user-agent") ?? "";
  if (!/Android/i.test(ua)) return false;
  if (/bot|crawler|spider|slurp|facebookexternalhit|whatsapp|telegram|preview/i.test(ua)) {
    return false;
  }

  return true;
}

export default clerkMiddleware((_auth, request) => {
  // Auth screens call Clerk client hooks; send them back to the public site in
  // a local visual-preview build, where ClerkProvider is deliberately absent.
  if (
    process.env.SCHOLARHUB_LOCAL_PREVIEW === "1" &&
    request.nextUrl.pathname.startsWith("/auth/")
  ) {
    const destination = new URL("/", request.url);
    destination.searchParams.set("preview", "auth-disabled");
    return NextResponse.redirect(destination, 307);
  }

  if (PLAY_STORE_URL && shouldRedirectAndroidToPlayStore(request)) {
    return NextResponse.redirect(PLAY_STORE_URL, 302);
  }
});

export const config = {
  matcher: [
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
    // Skip static assets (including ads.txt) so crawlers get CDN files, not middleware cold starts
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt|json|js|html|xml|ico|woff2?|webmanifest)$).*)",
  ],
};

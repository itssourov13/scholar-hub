import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

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

const clerkProxy = clerkMiddleware((_auth, request) => {
  if (PLAY_STORE_URL && shouldRedirectAndroidToPlayStore(request)) {
    return NextResponse.redirect(PLAY_STORE_URL, 302);
  }
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  // Clerk middleware redirects real browser navigations to a handshake URL if
  // a development-browser cookie is missing. The placeholder `.local` host
  // cannot resolve on a phone. A local visual-preview build must bypass Clerk
  // middleware entirely (not merely omit ClerkProvider on the client).
  if (process.env.SCHOLARHUB_LOCAL_PREVIEW === "1") {
    if (request.nextUrl.pathname.startsWith("/auth/")) {
      const destination = new URL("/", request.url);
      destination.searchParams.set("preview", "auth-disabled");
      return NextResponse.redirect(destination, 307);
    }
    return NextResponse.next();
  }

  return clerkProxy(request, event);
}

export const config = {
  matcher: [
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
    // Skip static assets (including ads.txt) so crawlers get CDN files, not middleware cold starts
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt|json|js|html|xml|ico|woff2?|webmanifest)$).*)",
  ],
};

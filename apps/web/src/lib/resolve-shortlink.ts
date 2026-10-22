/**
 * Resolves "share" shortlinks (lnkd.in, bit.ly, t.co, etc.) to their real
 * destination URL, so the bulk-import flow can scrape/search for the actual
 * scholarship page instead of a redirect link.
 *
 * LinkedIn's `lnkd.in` shortlinks are a special case: they return HTTP 200
 * with an HTML "you are leaving LinkedIn" interstitial page rather than a
 * normal 3xx redirect, so a plain `fetch(..., { redirect: "follow" })` lands
 * on that interstitial, not the destination. The real URL is embedded in the
 * page as the `external_url_click` tracking link, so we extract it directly.
 */

const FETCH_TIMEOUT_MS = 8000;

export type ResolveResult = {
  ok: boolean;
  url: string | null;
  via: "redirect" | "linkedin-interstitial" | "unchanged";
  error?: string;
};

const LINKEDIN_INTERSTITIAL_PATTERNS = [
  /data-tracking-will-navigate\s+href="([^"]+)"/i,
  /href="([^"]+)"\s+data-tracking-control-name="external_url_click"/i,
];

const extractLinkedInDestination = (html: string): string | null => {
  for (const pattern of LINKEDIN_INTERSTITIAL_PATTERNS) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
};

export const resolveShortlink = async (url: string): Promise<ResolveResult> => {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { ok: false, url: null, via: "unchanged", error: "Invalid URL" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ScholarHubBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const finalUrl = res.url || parsed.toString();
    const isLinkedInInterstitial =
      parsed.hostname.includes("lnkd.in") || new URL(finalUrl).hostname.includes("linkedin.com");

    if (!isLinkedInInterstitial) {
      return { ok: true, url: finalUrl, via: finalUrl === parsed.toString() ? "unchanged" : "redirect" };
    }

    if (!res.ok) {
      return { ok: false, url: null, via: "linkedin-interstitial", error: `HTTP ${res.status}` };
    }

    const html = await res.text();
    const destination = extractLinkedInDestination(html);
    if (destination) {
      return { ok: true, url: destination, via: "linkedin-interstitial" };
    }
    return { ok: false, url: null, via: "linkedin-interstitial", error: "Could not find destination in interstitial page" };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false, url: null, via: "unchanged", error: aborted ? "Timed out resolving link" : String(err) };
  } finally {
    clearTimeout(timer);
  }
};

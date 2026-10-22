/**
 * Best-effort web scraper for scholarship pages. Fetches a URL server-side,
 * strips scripts/styles/markup, and returns plain text the model can read.
 *
 * This is intentionally simple — no headless browser. JS-heavy pages may
 * return little usable text, in which case the caller falls back to the
 * model's own knowledge. Treats all fetched content as untrusted.
 */

const MAX_BYTES = 600_000; // ~600KB cap to avoid huge pages
const MAX_TEXT_CHARS = 8000; // cap text passed to the model
const DEFAULT_FETCH_TIMEOUT_MS = 8000;

export type ScrapeResult = {
  ok: boolean;
  text: string;
  status?: number;
  error?: string;
};

const stripHtml = (html: string): string => {
  return html
    // remove script/style/noscript blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // turn block tags into newlines so text doesn't run together
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // drop all remaining tags
    .replace(/<[^>]+>/g, " ")
    // decode a few common entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    // collapse whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
};

const isValidHttpUrl = (value: string): boolean => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export const scrapeUrl = async (url: string, timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS): Promise<ScrapeResult> => {
  if (!url || !isValidHttpUrl(url)) {
    return { ok: false, text: "", error: "Invalid or missing URL" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Pretend to be a normal browser; some sites block default fetch UA
        "User-Agent":
          "Mozilla/5.0 (compatible; ScholarHubBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      return { ok: false, text: "", status: res.status, error: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return { ok: false, text: "", error: `Unsupported content-type: ${contentType}` };
    }

    // Read up to MAX_BYTES
    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      return { ok: true, text: stripHtml(text).slice(0, MAX_TEXT_CHARS) };
    }

    const decoder = new TextDecoder();
    let received = 0;
    let html = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      html += decoder.decode(value, { stream: true });
      if (received > MAX_BYTES) break;
    }

    const text = stripHtml(html).slice(0, MAX_TEXT_CHARS);
    return { ok: text.length > 0, text };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      text: "",
      error: aborted ? "Timed out fetching the page" : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * ScholarHub Service Worker
 * Provides an offline shell so the app loads instantly on repeat visits
 * and shows a friendly offline page when there's no connection.
 *
 * Strategy:
 *  - App shell (HTML, logo, manifest) → Cache-first
 *  - API calls → Network-first (never serve stale scholarship data)
 *  - Next.js router/RSC data fetches → always network, never intercepted
 *  - Images → not intercepted at all (see below)
 *  - Everything else → Network-first with cache fallback, capped
 */

const CACHE_VERSION = "v5";
const CACHE_NAME = `scholarhub-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const SHELL_ASSETS = [
  "/",
  "/scholarships",
  "/chat",
  "/dashboard",
  "/logo.png",
  "/manifest.json",
  OFFLINE_URL,
];

// Shell assets are written first at install, so a FIFO eviction would throw
// them out before anything else. Keep them exempt from trimming.
const SHELL_PATHS = new Set(SHELL_ASSETS);

// Ceiling on runtime (non-shell) entries. Without one the cache grows for the
// lifetime of the installation: every deploy's chunks, every visited route.
const MAX_RUNTIME_ENTRIES = 150;

// Walking the whole key list on every write is wasteful, so only trim
// periodically — overshooting the cap by a few entries is harmless.
const TRIM_EVERY = 10;
let writesSinceTrim = 0;

async function trimCache(cache) {
  const keys = await cache.keys();
  const evictable = keys.filter((req) => !SHELL_PATHS.has(new URL(req.url).pathname));
  // cache.keys() returns insertion order, so the front of the list is oldest.
  const excess = evictable.length - MAX_RUNTIME_ENTRIES;
  for (let i = 0; i < excess; i++) {
    await cache.delete(evictable[i]);
  }
}

// ── Install: pre-cache the shell ──────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // `cache.addAll` is all-or-nothing: if a single shell asset is
      // momentarily unreachable the whole call rejects and NOTHING gets
      // cached — including the offline page itself. Cache each asset
      // independently instead so one flaky request can't take the rest down.
      await Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)));
    })(),
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// ── Fetch: network-first for API, cache-first for shell ──────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API routes → always network, never cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Next.js's client-side router fetches page data (RSC "flight" streams),
  // not HTML — using the cached HTML page or the offline fallback for one of
  // these breaks the router (it can't parse HTML as a flight stream) and can
  // take down navigation on the page entirely. Always let these hit network.
  const isRouterDataRequest =
    request.headers.has("rsc") ||
    request.headers.has("next-router-state-tree") ||
    request.headers.has("next-router-prefetch") ||
    request.headers.has("next-router-segment-prefetch");
  if (isRouterDataRequest) return;

  // Media is left entirely to the browser. Optimised images come back with
  // `Cache-Control: max-age=31536000` already, so a second copy here just
  // doubles the storage — and since they carry `Vary: Accept`, many of those
  // copies would never match a later request anyway. Audio/video additionally
  // arrive as 206 range responses, which aren't safely cacheable.
  if (
    url.pathname === "/_next/image" ||
    request.destination === "image" ||
    request.destination === "video" ||
    request.destination === "audio"
  ) {
    return;
  }

  // Everything else → network-first, fall back to cache, then offline page
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        // 200 only: partial (206) and opaque responses can't be replayed.
        if (response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          // waitUntil keeps the worker alive until the write lands; a bare
          // floating promise can be killed mid-put once the response is
          // returned, leaving a half-populated cache.
          event.waitUntil(
            (async () => {
              try {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, clone);
                if (++writesSinceTrim >= TRIM_EVERY) {
                  writesSinceTrim = 0;
                  await trimCache(cache);
                }
              } catch {
                // Storage pressure (QuotaExceededError) or an unstorable
                // response. Never let a caching failure reject the fetch that
                // already succeeded.
              }
            })(),
          );
        }
        return response;
      } catch {
        // Network failed outright (offline / DNS / connection reset). Fall
        // back to a cached copy, then the offline shell — and always resolve
        // to a real Response so the browser never sees an invalid result
        // from respondWith (which shows up as a hard "page couldn't load").
        const cached = await caches.match(request);
        if (cached) return cached;
        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })(),
  );
});

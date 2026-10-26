/* eslint-disable no-restricted-globals */
/**
 * Electronic Archive — Service Worker
 * ====================================
 * Provides offline-first behaviour and resilient caching for the local
 * deployment. Strategy summary:
 *
 *   - App shell (HTML / JS / CSS / fonts / images) → Cache-First
 *     so the UI opens INSTANTLY even when the network or the server is down.
 *
 *   - GET /api/* → NETWORK-FIRST (was: Stale-While-Revalidate)
 *     Always try the network first so freshly-written records appear
 *     immediately after save. Fall back to cache only when the network is
 *     unreachable (true offline scenario). This fixes the bug where new
 *     records appeared only after a manual page reload.
 *
 *   - Non-GET /api/* (POST/PUT/DELETE/PATCH) → Network-only
 *     Never cached. We also wipe API caches for the affected collection
 *     after a successful write so any earlier GET responses can never
 *     "out-vote" the new state.
 *
 *   - /api/version → Network-only (always fresh so the version-check works)
 *
 * Note: when the page that registered the SW loads a NEW build, the SW
 * itself will be replaced because its filename is content-hashed by CRA's
 * service-worker tooling. For our manual SW we use a version string in
 * CACHE_NAME — bumping CACHE_VERSION forces old caches to be cleared.
 */
// Dynamic version that changes with each build
const BUILD_TIMESTAMP = "__BUILD_TIMESTAMP__"; // Replaced during build
const CACHE_VERSION = BUILD_TIMESTAMP !== "__BUILD_TIMESTAMP__" ? `v-${BUILD_TIMESTAMP}` : `v-${Date.now()}`;
const STATIC_CACHE = `ea-static-${CACHE_VERSION}`;
const API_CACHE = `ea-api-${CACHE_VERSION}`;


// Listen for messages from the client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === "CLIENTS_CLAIM") {
    self.clients.claim();
  }
});

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
];

// ─── Lifecycle ────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
  // Activate immediately so the page benefits on first load.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean any old caches that don't match the current version.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(`-${CACHE_VERSION}`))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Allow the page to nudge the SW (e.g. "skipWaiting" on a new version detected).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "CLEAR_API_CACHE") {
    caches.delete(API_CACHE);
  }
});

// ─── Fetch strategy ───────────────────────────────────────────────────────
const isApiRequest = (url) => url.pathname.startsWith("/api/");
const isVersionPing = (url) => url.pathname === "/api/version" || url.pathname.endsWith("/api/version");
const isMutating = (method) => !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Don't try to handle cross-origin requests (e.g. CDN fonts).
  if (url.origin !== self.location.origin) return;

  // For mutating /api/* calls, go straight to the network AND wipe the API
  // cache on success — otherwise any subsequent GET could be served from a
  // stale cached response and the user would not see the just-saved data
  // until they hard-refreshed the page (the original bug this SW caused).
  if (isApiRequest(url) && isMutating(req.method)) {
    event.respondWith(
      (async () => {
        const response = await fetch(req);
        if (response && response.ok) {
          // Best-effort: drop the entire API cache so any previously cached
          // list response is invalidated for this and every other collection.
          caches.delete(API_CACHE).catch(() => {});
        }
        return response;
      })()
    );
    return;
  }

  // /api/version: always network-only so the version-check stays accurate.
  if (isApiRequest(url) && isVersionPing(url)) {
    return; // default browser behaviour (no SW handling)
  }

  if (isApiRequest(url)) {
    // Network-first for GET /api/*: never serve a stale list view.
    event.respondWith(networkFirst(req));
    return;
  }

  // HTML files (index.html, etc.) - Network-First for immediate updates
  if (url.pathname === "/" || url.pathname.endsWith(".html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Static assets / SPA shell — Cache-First with network fallback.
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Update in the background so users get fresh shell on the next visit.
    fetch(request)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          cache.put(request, res.clone()).catch(() => {});
        }
      })
      .catch(() => {});
    return cached;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch (err) {
    // If the network is down, fall back to the SPA shell so the React app at
    // least boots and shows the offline banner.
    const fallback = await cache.match("/index.html");
    if (fallback) return fallback;
    throw err;
  }
}

async function swrStrategy(request) {
  // Deprecated — kept as a fallback alias for `networkFirst`. Older builds
  // that referenced this helper still work, but new code goes through
  // networkFirst() directly (see fetch handler above).
  return networkFirst(request);
}

async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) {
      // Snapshot the response into the cache so a subsequent OFFLINE visit
      // can still render the last-seen data.
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    // Network unreachable — try to serve the last cached snapshot.
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({
        detail: "offline",
        message: "تعذر الاتصال بالخادم. لا توجد نسخة محفوظة محلياً لهذا الطلب.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

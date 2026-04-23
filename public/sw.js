// Trace service worker.
// - Precaches an app shell (offline page + manifest + icons) so navigation
//   works with no network.
// - Runtime caches same-origin static assets (Next.js _next/static/*) with
//   cache-first and HTML pages with network-first-falling-back-to-cache.
// - Never caches POST/PATCH or /api/* (those are queued via IndexedDB in the
//   client; see lib/offline-submit.ts).
// - Listens for "sync" (Chromium Background Sync) and pings clients to drain.

const VERSION = "trace-v3";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const HTML_CACHE = `${VERSION}-html`;

const SHELL_URLS = [
  "/offline",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        SHELL_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (_) {
            // Tolerate individual shell misses; offline page is most critical.
          }
        })
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (!k.startsWith(VERSION)) return caches.delete(k);
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "trace-drain") {
    event.waitUntil(notifyDrain());
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "trace-skip-waiting") {
    self.skipWaiting();
  }
});

async function notifyDrain() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: "trace-drain" });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API — those are handled by offline queue in app code.
  if (url.pathname.startsWith("/api/")) return;

  // HTML navigations: network-first, fall back to cached HTML, then /offline.
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(handleNavigate(req));
    return;
  }

  // Next.js static assets: cache-first (immutable hashed filenames).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // Other same-origin GETs (images, icons, manifest): stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
});

async function handleNavigate(req) {
  const cache = await caches.open(HTML_CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (_) {
    const cached = await cache.match(req);
    if (cached) return cached;
    const shell = await caches.open(SHELL_CACHE);
    const offline = await shell.match("/offline");
    if (offline) return offline;
    return new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (_) {
    return hit || new Response("", { status: 504 });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => hit || new Response("", { status: 504 }));
  return hit || fetchPromise;
}

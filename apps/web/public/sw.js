/*
 * Union service worker.
 *
 * Deliberately conservative: NETWORK-FIRST for everything so an installed app
 * always shows fresh content when online, while still working offline from the
 * runtime cache. Hashed Next.js assets are safe to cache long-term; HTML is
 * revalidated on every navigation. A branded /offline page is precached as the
 * last-resort fallback for navigations with no cached match.
 */
const CACHE = "union-cache-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Best-effort precache of the offline shell; don't fail install if it 404s.
      try {
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch (e) {
        /* ignore */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle same-origin GET; let the browser handle the rest (POST, APIs,
  // cross-origin, auth, etc.) so nothing surprising gets cached.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        // Stash a copy for offline use (ignore opaque/failed responses).
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const offline = await cache.match(OFFLINE_URL);
          if (offline) return offline;
        }
        throw err;
      }
    })()
  );
});

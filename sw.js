// Network-first service worker: always try the network so new builds show up immediately
// after a reload (no manual cache clearing), and fall back to cache only when offline.
const CACHE = "vr-shapes-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // only manage our own files; let the CDN libraries use the browser's normal cache
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});

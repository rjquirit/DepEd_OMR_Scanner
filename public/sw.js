// OMR Scanner Service Worker - Tangerine Edition
const CACHE_NAME = "omr-scanner-tangerine-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable.svg"
];

// Install event: Pre-cache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("SW install caching warning:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event: Clean old caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Network-first for API, Stale-while-revalidate for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip caching for non-GET and API routes (e.g. /api/scan-omr)
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // HTML navigation: Network first with cache fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const clonedResponse = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse));
          return networkResponse;
        })
        .catch(() => caches.match("/") || caches.match("/index.html"))
    );
    return;
  }

  // Other assets (scripts, styles, images, fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch((err) => {
          // If offline and not in cache, fallback
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

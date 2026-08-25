// DepEd Region X 60-Item OMR Scanner - Standalone PWA Offline Service Worker
// Version: omr-scanner-v4-pwa

const CACHE_NAME = "omr-scanner-v4-pwa";
const RUNTIME_CACHE_NAME = "omr-scanner-runtime-v4";

const CORE_STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable.png",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable.svg"
];

// Install: Pre-cache core PWA application shell & icons
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(CORE_STATIC_ASSETS).catch((err) => {
          console.warn("[PWA SW] Core asset pre-caching notice:", err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Prune stale caches & immediately claim all open clients
self.addEventListener("activate", (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE_NAME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !currentCaches.includes(name))
            .map((name) => {
              console.log("[PWA SW] Deleting deprecated cache:", name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Message listener for manual skip-waiting from client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch: Robust Offline & Standalone PWA Strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept non-GET requests (e.g. POST /api/scan-omr)
  if (request.method !== "GET") {
    return;
  }

  // 2. Handle HTML navigation requests (Single Page App Fallback for Standalone PWA)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline, return cached navigation root or index.html
          const cachedNav = (await caches.match(request)) || (await caches.match("/index.html")) || (await caches.match("/"));
          if (cachedNav) {
            return cachedNav;
          }
          return new Response("DepEd Region X OMR Scanner (Offline Mode Active)", {
            status: 200,
            statusText: "OK",
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        })
    );
    return;
  }

  // 3. Static Icons & Manifest (Cache-First for instant PWA startup)
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json") {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. Google Fonts stylesheets & Font Binaries (Cache-First with permanent storage)
  if (url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com") {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          return new Response("", { status: 408, headers: { "Content-Type": "text/css" } });
        });
      })
    );
    return;
  }

  // 5. App scripts, styles, and static assets (Stale-While-Revalidate with runtime cache)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseClone = networkResponse.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

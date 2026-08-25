// DepEd Region X 60-Item OMR Scanner - Offline Service Worker
// Version: omr-scanner-v3-offline

const CACHE_NAME = "omr-scanner-v3-offline";
const RUNTIME_CACHE_NAME = "omr-scanner-runtime-v3";

const CORE_STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable.svg"
];

// Install: Pre-cache the application shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(CORE_STATIC_ASSETS).catch((err) => {
          console.warn("[SW] Core asset pre-caching non-fatal notice:", err);
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
              console.log("[SW] Deleting deprecated cache:", name);
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

// Fetch: Robust Offline Strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept non-GET requests (e.g. POST /api/scan-omr)
  if (request.method !== "GET") {
    return;
  }

  // 2. Handle HTML navigation requests (Single Page App Fallback)
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
          return new Response("Offline - Please connect to the internet to load for the first time.", {
            status: 503,
            statusText: "Service Unavailable Offline",
            headers: { "Content-Type": "text/plain" }
          });
        })
    );
    return;
  }

  // 3. Google Fonts stylesheets & Font Binaries (Cache-First with permanent storage)
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

  // 4. App scripts, styles, images, and static assets (Stale-While-Revalidate with runtime cache)
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
          // Return cached response if network fails
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

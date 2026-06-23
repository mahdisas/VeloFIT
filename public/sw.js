/* veloFIT service worker.
 *
 * Scope: installability + offline resilience, kept deliberately HMR-safe.
 *   - Navigations  → network-first, falling back to cache, then /offline.html.
 *   - Images/fonts → cache-first (stale-while-revalidate), same-origin only.
 *   - Everything else (incl. /_next/ JS·CSS·RSC and HMR) → passed straight
 *     through to the network, so dev hot-reload and build chunks are untouched.
 *
 * Bump CACHE_VERSION to force old caches out on the next activation.
 */
const CACHE_VERSION = "v3";
const STATIC_CACHE = `velofit-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `velofit-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

const ASSET_RE = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave Supabase / 3rd-party alone

  // App navigations: always try the network; fall back to cache, then offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Same-origin images & fonts: serve from cache fast, refresh in the background.
  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
  // else: default network handling (covers /_next/* and RSC — never cached here).
});

// --- Web Push (inert until VAPID keys + subscriptions are wired server-side) ---
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "veloFIT", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "veloFIT", {
      body: data.body,
      icon: data.icon || "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [100, 50, 100],
      data: data.data || {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});

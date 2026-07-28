// Minimal service worker. Its main job here is simply to *exist and control
// the page* — that's what makes Chrome/Android offer the real "Install app"
// experience (a standalone window, proper icon, splash screen) instead of
// falling back to a plain "Add shortcut" bookmark when only a manifest is
// present with no service worker.
//
// It also caches the app shell so the icon/name are available offline and
// on a slow first load, but network requests otherwise just pass through
// live — this app is realtime/chat-based, so we deliberately do NOT cache
// API/Supabase responses.

const CACHE_NAME = "sonatg-shell-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle simple GET navigations/assets; let everything else
  // (POST/PUT, Supabase realtime, API calls) go straight to the network.
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached ?? network;
    })
  );
});

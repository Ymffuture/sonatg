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

// v2: bumped to force-purge the old cache. v1 used a cache-first strategy,
// which could serve a stale index.html referencing JS chunk filenames from
// a previous deploy (this app's build hashes change every deploy) while
// the currently-running code expects the NEW chunks — loading old and new
// module versions together can throw exactly this kind of confusing
// "X is not defined" runtime error, because it's not really a code bug,
// it's two incompatible builds' code executing side by side.
const CACHE_NAME = "sonatg-shell-v2";
const APP_SHELL = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

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

  // Network-first: always prefer the live, currently-deployed code when
  // online. Cache is purely an offline fallback (and a fast-first-paint
  // source for the handful of static app-shell assets), never allowed to
  // shadow a fresh deploy the way cache-first did.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

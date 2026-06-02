const CACHE_NAME = "kc135-pwa-v1.10"; // bump version to refresh cache
const ASSETS = [
  "./",
  "./app.js?v=1.8",
  "./manifest.json",
  "./icons/android-chrome-192.png?v=1.10",
  "./icons/android-chrome-512.png?v=1.10",
  "./icons/apple-touch-icon-180.png?v=1.10",
  "./icons/apple-touch-icon-167.png?v=1.10",
  "./icons/apple-touch-icon-152.png?v=1.10",
  "./icons/apple-touch-icon-120.png?v=1.10",
  "./assets/simba.jpg?v=1.10"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});

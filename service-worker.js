const CACHE_NAME = "kc135-pwa-v5_9_8"; // bump version to refresh cache
const ASSETS = [
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icons/android-chrome-192.png",
  "./icons/android-chrome-512.png",
  "./icons/apple-touch-icon-180.png"
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

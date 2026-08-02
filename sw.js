const CACHE_NAME = "w2w-count-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./firebase-config.js",
  "./manifest.json",
  "./sku-master.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
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

// App-shell files: cache first (fast + offline). Firestore's own SDK
// handles offline queueing for the actual count data.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isAppShellFile = APP_SHELL.some((f) => url.pathname.endsWith(f.replace("./", "")));
  if (!isAppShellFile) return; // let Firebase/network requests pass through normally

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

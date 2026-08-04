const CACHE_NAME = "w2w-count-v2"; // bumped: forces old stale caches to clear on this deploy
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

// Network-first, cache as offline fallback only.
// Previously this was "cache first," which meant once a file (like
// sku-master.json) was cached on first use, updates to it on the server
// were never picked up — the app kept serving whatever was cached on day one.
// Network-first always tries to get the latest version first, and only
// falls back to the cached copy if there's no network at all.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isAppShellFile = APP_SHELL.some((f) => url.pathname.endsWith(f.replace("./", "")));
  if (!isAppShellFile) return; // let Firebase/other requests pass through normally

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

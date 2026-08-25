/* Ledger service worker — makes the app work with no internet.
   Bump CACHE whenever you upload a new index.html. That is what tells
   every installed phone that a fresh copy is waiting. */
const CACHE = "ledger-1.5";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // one missing file must not break install
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Serve from the phone first so it opens instantly and offline,
   then quietly refresh the copy in the background for next time. */
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached || caches.match("./index.html"));

      return cached || network;
    })
  );
});

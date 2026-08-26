/* Ledger service worker.
   You should never need to edit this file again.

   The app itself is fetched fresh whenever there's a connection, and served
   from the phone when there isn't. So updating Ledger means replacing
   index.html and nothing else — no version numbers to bump. */

const CACHE = "ledger";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.png", "./icon-512.png"];
const NET_TIMEOUT = 2500;

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Race the network against a short timer. Whichever wins, the cached copy
   is quietly brought up to date for next time. */
function fallbackFor(req) {
  return caches.match(req, { ignoreSearch: true })
    .then(hit => hit || caches.match("./index.html"))
    .then(hit => hit || Response.error());
}

function freshFirst(req) {
  return new Promise(resolve => {
    let settled = false;
    const done = r => { if (!settled) { settled = true; resolve(r); } };
    const timer = setTimeout(() => done(fallbackFor(req)), NET_TIMEOUT);

    fetch(req).then(res => {
      clearTimeout(timer);
      if (res && res.status === 200 && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      done(res);
    }).catch(() => {
      clearTimeout(timer);
      done(fallbackFor(req));
    });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  const url = new URL(req.url);
  const isApp = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");

  if (isApp) {
    e.respondWith(freshFirst(req));            // always reach for the newest app
    return;
  }

  // Icons and manifest never change — serve them instantly from the phone.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit =>
      hit || fetch(req).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => fallbackFor(req))
    )
  );
});

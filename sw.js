// G$tick Golf service worker. Build 77f28ffc9b.
// The page: network first (a new round shows up as soon as you're online), the cached copy when offline or after 4 s.
// three.js, icons and launch screens: from the cache. Google Fonts: cached the first time they load, then served from the cache.
const CORE = 'gstick-core-77f28ffc9b', FONTS = 'gstick-fonts';
const FILES = ["./", "./index.html", "./three.min.js", "./manifest.webmanifest", "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./splash/splash-1179x2556.png", "./splash/splash-1206x2622.png", "./splash/splash-1320x2868.png"];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CORE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('gstick-core-') && k !== CORE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
// Safari refuses a redirected response for a page load (e.g. /gstick-golf -> /gstick-golf/): hand back a clean copy
const clean = (res) => res.redirected ? res.blob().then((b) => new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers })) : res;
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (r.mode === 'navigate') {
    e.respondWith(Promise.race([fetch(r), timeout(4000)]).then(clean).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CORE).then((c) => c.put('./index.html', copy)); }
      return res;
    }).catch(() => caches.match('./index.html', { ignoreSearch: true })));
    return;
  }
  if (u.origin === self.location.origin) { e.respondWith(caches.match(r, { ignoreSearch: true }).then((m) => m || fetch(r))); return; }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then((c) => c.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }))));
  }
});

"""G$tick Golf build. Run `python3 build.py` from the repository root after every change.

Writes:
  - the site at the repository root, which GitHub Pages serves (https://thazerk12.github.io/gstick-golf/):
      index.html, sw.js, manifest.webmanifest, three.min.js, icons/, splash/, .nojekyll
    This is the installable home-screen app: iOS full-screen tags, the G$ icon, iPhone launch screens, a local three.js
    (r128), and a service worker for offline play. The service worker's cache name is a hash of everything the site
    ships, so every new build replaces the old one on the player's next online launch.
  - tempo-golf.html: the page body the claude.ai artifact wraps (kept as a fallback; not committed).
"""
import hashlib, json, os, shutil

src = open('game.src.html').read()
eng = open('engine.js').read(); game = open('game.js').read()
out = src.replace('/*__ENGINE__*/', eng).replace('/*__GAME__*/', game)

# claude.ai artifact body
open('tempo-golf.html', 'w').write(out)

# the site: same game, with three.js served from the site itself instead of the CDN
CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
assert out.count(CDN) == 1
body = out.replace(CDN, '<script src="three.min.js"></script>')
THREE_NPM = 'node_modules/three/build/three.min.js'   # r128; without node_modules the committed copy is kept
three = open(THREE_NPM if os.path.exists(THREE_NPM) else 'three.min.js', 'rb').read()

# iPhone launch screens, portrait @3x: (CSS width, CSS height, file in app_assets/)
SPLASH = [(393, 852, 'splash-1179x2556.png'), (402, 874, 'splash-1206x2622.png'), (440, 956, 'splash-1320x2868.png')]
ICONS = ['apple-touch-icon.png', 'favicon-32.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']
splash = '\n'.join(f'<link rel="apple-touch-startup-image" media="screen and (device-width: {w}px) and (device-height: {h}px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="splash/{f}">' for w, h, f in SPLASH)
head = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="G$tick Golf">
<meta name="theme-color" content="#1F3A2A">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
{splash}
</head>
<body>
'''
sw_reg = '''<script>
// offline play and updates (needs http/https; skipped when the file is opened directly)
if ('serviceWorker' in navigator && location.protocol !== 'file:') addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
</script>
'''
manifest = {
    'id': './', 'name': 'G$tick Golf', 'short_name': 'G$tick Golf', 'description': 'Pull back, flick through. A physics golf game.',
    'start_url': './', 'scope': './', 'display': 'standalone', 'background_color': '#1F3A2A', 'theme_color': '#1F3A2A',
    'icons': [
        {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
}
core = ['./', './index.html', './three.min.js', './manifest.webmanifest'] + ['./icons/' + i for i in ICONS] + ['./splash/' + f for _, _, f in SPLASH]
sw = '''// G$tick Golf service worker. Build __VER__.
// The page: network first (a new round shows up as soon as you're online), the cached copy when offline or after 4 s.
// three.js, icons and launch screens: from the cache. Google Fonts: cached the first time they load, then served from the cache.
const CORE = 'gstick-core-__VER__', FONTS = 'gstick-fonts';
const FILES = CORE_LIST;
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
'''
# the build's title, font links and stylesheet belong in <head>; the markup and scripts after them in <body>
cut = body.index('</style>') + len('</style>')
index = head.replace('</head>\n<body>\n', body[:cut] + '\n</head>\n<body>\n') + body[cut:] + '\n' + sw_reg + '</body>\n</html>\n'
# build version: a hash of everything the site ships
h = hashlib.sha1(index.encode() + three + json.dumps(manifest).encode() + sw.encode())
for f in ICONS + [f for _, _, f in SPLASH]: h.update(open('app_assets/' + f, 'rb').read())
ver = h.hexdigest()[:10]
sw = sw.replace('__VER__', ver).replace('CORE_LIST', json.dumps(core))

open('index.html', 'w').write(index)
open('three.min.js', 'wb').write(three)
open('manifest.webmanifest', 'w').write(json.dumps(manifest, indent=1) + '\n')
open('sw.js', 'w').write(sw)
for d, files in (('icons', ICONS), ('splash', [f for _, _, f in SPLASH])):
    if os.path.isdir(d): shutil.rmtree(d)
    os.makedirs(d)
    for f in files: shutil.copy('app_assets/' + f, d + '/' + f)
open('.nojekyll', 'w').write('')   # GitHub Pages: serve the files as they are
print(len(out), 'build', ver)

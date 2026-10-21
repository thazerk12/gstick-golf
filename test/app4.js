// The site (the repository root, as GitHub Pages serves it): served over http under /gstick-golf/. Checks the manifest and icons,
// that the service worker takes control, that the game reaches the menu and plays a shot with the network off,
// and that a newer build replaces the old one on the next online launch.
// usage: node test/app4.js <out-dir>   (run build.py first)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.argv[2] || '/tmp/app4', ROOT = path.join(__dirname, '..');
fs.mkdirSync(OUT, { recursive: true });
// a copy of the app we can change to stand in for "next round"
const SITE = path.join(OUT, 'site'); fs.rmSync(SITE, { recursive: true, force: true }); fs.mkdirSync(SITE, { recursive: true });
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'three.min.js', '.nojekyll', 'icons', 'splash']) fs.cpSync(path.join(ROOT, f), path.join(SITE, f), { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/gstick-golf') { res.writeHead(301, { location: '/gstick-golf/' }); return res.end(); }
  if (!u.startsWith('/gstick-golf/')) { res.writeHead(404); return res.end(); }
  let f = path.join(SITE, u.slice('/gstick-golf/'.length) || 'index.html'); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'max-age=600' }); fs.createReadStream(f).pipe(res);
}).listen(8765);
const FONTS = path.join(__dirname, 'fonts');
const FACES = [['Archivo', 'normal', 400, 'archivo-latin-400-normal.woff2'], ['Archivo', 'normal', 500, 'archivo-latin-500-normal.woff2'], ['Archivo', 'normal', 600, 'archivo-latin-600-normal.woff2'], ['Archivo', 'normal', 700, 'archivo-latin-700-normal.woff2'], ['Archivo', 'normal', 800, 'archivo-latin-800-normal.woff2'], ['Big Shoulders Display', 'normal', 700, 'big-shoulders-display-latin-700-normal.woff2'], ['Big Shoulders Display', 'normal', 800, 'big-shoulders-display-latin-800-normal.woff2'], ['Big Shoulders Display', 'normal', 900, 'big-shoulders-display-latin-900-normal.woff2'], ['Fraunces', 'italic', 900, 'fraunces-i900-o9-s50-w1.woff2']];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
  // Google Fonts from local files (the sandbox can't reach Google); context routes also cover the service worker's fetches
  const css = FACES.map(([fam, st, w, f]) => `@font-face{font-family:'${fam}';font-style:${st};font-weight:${w};font-display:swap;src:url(https://fonts.gstatic.com/local/${f}) format('woff2');}`).join('\n');
  let fontHits = 0;
  await ctx.route('**/fonts.googleapis.com/**', r => { fontHits++; r.fulfill({ status: 200, contentType: 'text/css', headers: { 'access-control-allow-origin': '*' }, body: css }); });
  await ctx.route('**/fonts.gstatic.com/**', r => { fontHits++; r.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(FONTS, path.basename(new URL(r.request().url()).pathname))) }); });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  const res = {};
  const menu = () => page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  // 1) first launch, online
  await page.goto('http://localhost:8765/gstick-golf/'); await menu();
  res.first = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready; const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
    const icons = await Promise.all([...m.icons.map(i => i.src), 'icons/apple-touch-icon.png', ...[...document.querySelectorAll('link[rel=apple-touch-startup-image]')].map(l => l.getAttribute('href'))].map(async (s) => { const r = await fetch(s); const b = await createImageBitmap(await r.blob()); return s + ' ' + r.status + ' ' + b.width + 'x' + b.height; }));
    return { swActive: !!reg.active, scope: reg.scope, manifest: { name: m.name, display: m.display, start: m.start_url }, icons, three: typeof THREE !== 'undefined' && THREE.REVISION, threeFrom: [...document.scripts].map(s => s.src).filter(s => /three/.test(s)), title: document.title, headLinks: document.head.querySelectorAll('link').length };
  });
  // 2) relaunch online: the service worker now controls the page; fonts get cached
  await page.reload(); await menu(); await page.waitForTimeout(800);
  res.second = await page.evaluate(async () => ({ controlled: !!navigator.serviceWorker.controller, caches: await caches.keys(), fraunces: document.fonts.check('italic 900 24px Fraunces') }));
  // 3) network off: relaunch, reach the menu, play a shot
  const hitsBefore = fontHits;
  await ctx.setOffline(true);
  await page.reload(); await menu(); await page.waitForTimeout(800);
  res.offline = await page.evaluate(() => {
    const T = window.__tempo, G = T.G; const f = document.fonts.check('italic 900 24px Fraunces');
    T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'offline', tier: 2, course: 0 }); G.manual = true;
    for (let i = 0; i < 240; i++) T.tick(1 / 60, false); G.club = 0; T.takeShot(1, 0, 1, 0); let n = 0; while (G.mode === 'flight' && n++ < 2000) T.tick(1 / 60, false); for (let i = 0; i < 200; i++) T.tick(1 / 60, false); T.tick(1 / 60, true);
    return { mode: G.mode, ballMovedM: +Math.hypot(G.ball.x, G.ball.z).toFixed(1), fraunces: f, controlled: !!navigator.serviceWorker.controller, online: navigator.onLine };
  });
  res.offline.fontRequestsWhileOffline = fontHits - hitsBefore;
  await page.screenshot({ path: path.join(OUT, 'offline_game.png') });
  // 4) "next round": a changed page and a new service worker; back online, the next launch shows it and drops the old cache
  await ctx.setOffline(false);
  fs.writeFileSync(path.join(SITE, 'index.html'), fs.readFileSync(path.join(SITE, 'index.html'), 'utf8').replace('<title>G$tick Golf</title>', '<title>G$tick Golf NEXT</title>'));
  fs.writeFileSync(path.join(SITE, 'sw.js'), fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8').replace(/gstick-core-[0-9a-f]+/, 'gstick-core-nextround'));
  await page.reload(); await menu(); await page.waitForTimeout(1500);
  res.update1 = await page.evaluate(async () => ({ title: document.title, caches: await caches.keys() }));
  await page.reload(); await menu(); await page.waitForTimeout(800);
  res.update2 = await page.evaluate(async () => ({ title: document.title, caches: await caches.keys() }));
  // 5) the new round also plays offline
  await ctx.setOffline(true); await page.reload(); await menu();
  res.update2.offlineTitle = await page.evaluate(() => document.title);
  res.errors = errs;
  console.log(JSON.stringify(res, null, 1));
  await browser.close(); server.close();
})();

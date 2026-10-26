// Round 6 Task 5: flight screenshots at 390x844 with the real gesture: a drive, a 7-iron, a 25 m chip and an 8 m putt, each
// mid-flight (strip, distance label, fast-forward) and at rest (the label's final distance, then the toast).
// usage: node test/flight6.js <page.html> <outdir>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUT = process.argv[3] || '/tmp/flight6';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real());
    const rST = window.setTimeout.bind(window), rCT = window.clearTimeout.bind(window); let tid = 1e7; window.__timers = new Map();
    window.setTimeout = (fn, ms, ...a) => { if (!window.__sim.on) return rST(fn, ms, ...a); const id = ++tid; window.__timers.set(id, { due: window.__sim.t + (+ms || 0), fn, a }); return id; };
    window.clearTimeout = (id) => { if (window.__timers.has(id)) window.__timers.delete(id); else rCT(id); };
    window.__runTimers = () => { for (const [id, t] of [...window.__timers]) if (t.due <= window.__sim.t) { window.__timers.delete(id); try { t.fn(...t.a); } catch (e) { console.error(e); } } };
  });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(OUT, 'fl6.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => {
    const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim;
    T.save().seenHow = true; T.save().shots = 99;
    T.startRound({ kind: 'quick', seed: 'frame-4', tier: 2, course: 0 }); G.manual = true;
    sim.base = performance.now(); sim.on = true; window.__k = 0;
    window.__tick = (n, draw) => { for (let i = 0; i < n; i++) { window.__k++; sim.t = sim.base + window.__k * 1000 / 60; T.tick(1 / 60, !!draw && i === n - 1); window.__runTimers(); } };
    const ev = (type, x, y) => (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 5, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' }));
    const h = G.hole, ci = (id) => E.CLUBS.findIndex(c => c.id === id);
    window.__shoot = (club, s, p, bx, up, fx) => {
      let x = 0, z = 0.6;
      if (club === 'PT') { for (let a = 0; a < 72; a++) { const t = a * Math.PI / 36, px = h.pin.x + Math.sin(t) * s, pz = h.pin.z + Math.cos(t) * s; if (h.surface(px, pz) === E.S.GREEN) { x = px; z = pz; break; } } }
      else if (club !== 'DR') { const q = h.pointAtS(Math.max(30, h.len - s)); x = q.x; z = q.z; }
      for (const id of ['toast', 'banner']) document.getElementById(id).classList.remove('show');
      G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = ci(club); G.strokes = 0; G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.mode = 'aim'; G.swing = null; G.press = null; G.shot = null; G.pendingShot = null; G.camYaw = null; G.camLock = false;
      Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, alphaT: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false }); T.setupClub(G.club); window.__tick(1); T.snap(); window.__tick(60);
      const L = T.swingLen(), x0 = 195, y0 = Math.round(T.chevronAt()[1]), D = L * p, n2 = Math.max(2, Math.round(up * 60));
      ev('pointerdown', x0, y0);
      for (let i = 1; i <= 27; i++) { const q = 1 - Math.pow(1 - i / 27, 2); ev('pointermove', x0 + bx * q, y0 + D * q); window.__tick(1); }
      for (let i = 1; i <= n2 + 4; i++) { const q = Math.min(1.2, Math.pow(i / n2, 2)); ev('pointermove', x0 + bx + fx * q, y0 + D - (D + 20) * q); window.__tick(1); if (G.mode === 'flight') break; }
      ev('pointerup', x0 + bx + fx, y0 - 20);
      for (let i = 0; i < 30 && G.mode !== 'flight'; i++) window.__tick(1);
      return { club, mode: G.mode };
    };
  });
  const shot = async (name) => { await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => { window.__tempo.tick(0, true); requestAnimationFrame(() => res()); }))); await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 180000 }); };
  const out = [];
  // club, distance setting, pull, back drift, upstroke s, through drift, frames after contact for the mid shot
  for (const [name, args, mid] of [['DR', ['DR', 0, 1.0, 12, 0.2, -8], 75], ['7I', ['7I', 150, 0.95, -10, 0.2, 10], 70], ['chip25m', ['PW', 25, 0.2, 0, 0.25, 0], 40], ['putt8m', ['PT', 8, 0.6, 0, 0.3, 2], 70]]) {
    const r = await page.evaluate((a) => window.__shoot(...a), args);
    r.mid = await page.evaluate((m) => { window.__tick(m); const T = window.__tempo; return { strip: [...document.querySelectorAll('#hudStats .card')].filter(e => !e.hidden).map(e => e.textContent.replace(/\s+/g, ' ').trim()), label: T.distLabel() && T.distLabel().text, ff: !document.getElementById('btnFF').hidden }; }, mid);
    await shot('flight_' + name + '_mid');
    r.rest = await page.evaluate(() => { const T = window.__tempo, G = T.G, b = G.ball, sh = G.shot; for (let i = 0; i < 1500 && G.mode === 'flight'; i++) window.__tick(1); window.__tick(20); const L = T.distLabel(); return { label: L && L.text, total: sh && +Math.hypot(b.x - sh.sx, b.z - sh.sz).toFixed(2), toast: document.getElementById('tQ').textContent + ' / ' + document.getElementById('tD').textContent, ff: !document.getElementById('btnFF').hidden }; });
    await shot('flight_' + name + '_rest');
    await page.evaluate(() => window.__tick(150));
    out.push(r); console.log(name, JSON.stringify(r));
  }
  fs.writeFileSync(path.join(OUT, 'flight6.json'), JSON.stringify({ shots: out, errors: errs }, null, 1));
  if (errs.length) console.log('errors', errs);
  await browser.close();
})();

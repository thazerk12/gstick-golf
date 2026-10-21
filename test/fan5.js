// Round 5 Task 3e: the direction fan at the top of a full backswing (a 100% pull, held), driver and 7-iron, 390x844.
// Also reads back the fan's geometry from the game (ball point, radii, half-angles) for the report.
// usage: node test/fan5.js <page.html> <outdir>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUT = process.argv[3] || '/tmp/fan5';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(OUT, 'fan5.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => {
    const T = window.__tempo, G = T.G, sim = window.__sim; T.save().seenHow = true; T.save().shots = 99;
    T.startRound({ kind: 'quick', seed: 'fan-5', tier: 2, course: 0 }); G.manual = true; sim.base = performance.now(); sim.on = true;
    window.__k = 0; window.__tick = (n, d) => { for (let i = 0; i < n; i++) { window.__k++; sim.t = sim.base + window.__k * 1000 / 60; T.tick(1 / 60, d && i === n - 1); } };
    window.__ev = (type, x, y) => (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 4, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' }));
    for (let i = 0; i < 900 && G.mode !== 'aim'; i++) window.__tick(1, false);
  });
  const out = [];
  for (const id of ['DR', '7I']) {
    const r = await page.evaluate((id) => {
      const T = window.__tempo, G = T.G, E = T.E, h = G.hole, ci = E.CLUBS.findIndex(c => c.id === id);
      let x = 0, z = 0.6; if (ci > 0) { const p = h.pointAtS(Math.min(h.len - 60, 230)); x = p.x; z = p.z; }
      G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = ci; G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.mode = 'aim'; G.swing = null; G.shot = null; G.previewDirty = true;
      T.setupClub(ci); T.snap(); window.__tick(5, false); T.snap(); window.__tick(60, false);
      const z0 = T.swingZone(), L = T.swingLen(), sx = innerWidth / 2, y0 = Math.ceil(z0.top) + 8;
      window.__ev('pointerdown', sx, y0); window.__tick(1, false);
      for (let i = 1; i <= 27; i++) { window.__ev('pointermove', sx, y0 + L * (1 - Math.pow(1 - i / 27, 2))); window.__tick(1, false); }
      window.__tick(12, true);
      const P = T.FEEL.path, b = T.ballScreen();
      return { club: id, mode: G.mode, power: +G.swing.power.toFixed(3), fanA: +T.state().fanA.toFixed(3), ball: b.map(v => +v.toFixed(1)), r0: +(P.fanR0 * L).toFixed(1), r1: +(P.fanR1 * L).toFixed(1),
        halfDeg: +(Math.atan(P.dead + 0.12 * P.span) * 180 / Math.PI).toFixed(2), pureDeg: +(Math.atan(P.pure) * 180 / Math.PI).toFixed(2), fanTopY: +(b[1] - P.fanR1 * L).toFixed(1) };
    }, id);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'fan_' + id + '_top.png'), timeout: 180000 });
    out.push(r);
    await page.evaluate(() => { window.__ev('pointerup', innerWidth / 2, 700); window.__tick(60, false); });
  }
  console.log(JSON.stringify(out), errs.length ? errs : '');
  await browser.close();
})();

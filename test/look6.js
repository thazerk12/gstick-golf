// Round 6 Task 2d-f: the aim beam, look mode and the look-only map at 390x844 (simulated clock, synthetic touch).
// Look: DR from the tee, 7I from the fairway, a putt: fly-in and fly-out times (frames at 60 Hz), the marker, the green grid,
// a one-finger pan and a pinch, a pull-down that must not swing, and the aim, club and ball position after returning.
// Map: taps don't aim or pick a club; a drag pans; a pinch zooms. Beam: mid-drag and 0.3 s after release; at rest (none).
// usage: node test/look6.js <page.html> <outdir>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUT = process.argv[3] || '/tmp/look6';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(OUT, 'lk6.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => {
    const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim;
    T.save().seenHow = true; T.save().shots = 99;
    T.startRound({ kind: 'quick', seed: 'look-6', tier: 2, course: 0 }); G.manual = true;
    sim.base = performance.now(); sim.on = true; window.__k = 0;
    window.__tick = (n, draw) => { for (let i = 0; i < n; i++) { window.__k++; sim.t = sim.base + window.__k * 1000 / 60; T.tick(1 / 60, !!draw && i === n - 1); } };
    window.__ev = (type, x, y, id) => (type === 'pointerdown' ? (document.elementFromPoint(x, y) || document.body) : window).dispatchEvent(new PointerEvent(type, { pointerId: id || 5, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: (id || 5) === 5, pointerType: 'touch' }));
    window.__put = (kind) => {
      const h = G.hole; let x = 0, z = 0.6, ci = 0;
      if (kind === '7I') { const p = h.pointAtS(Math.max(60, h.len - 150)); x = p.x; z = p.z; ci = E.CLUBS.findIndex(c => c.id === '7I'); }
      if (kind === 'putt') { ci = E.CLUBS.length - 1; for (let a = 0; a < 72; a++) { const t = a * Math.PI / 36, px = h.pin.x + Math.sin(t) * 6, pz = h.pin.z + Math.cos(t) * 6; if (h.surface(px, pz) === E.S.GREEN) { x = px; z = pz; break; } } }
      G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = ci; G.strokes = 0; G.aim = Math.atan2(h.pin.x - x, h.pin.z - z) + 0.03; G.mode = 'aim'; G.map = false; G.look = null; G.swing = null; G.press = null; G.shot = null; G.camYaw = null; G.camLock = false; G.previewDirty = true;
      Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, alphaT: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false }); T.setupClub(ci); window.__tick(1); T.snap(); window.__tick(90); T.updateHUD && T.updateHUD(true);
      return { club: E.CLUBS[ci].id, lie: E.SURF_NAMES[G.lie] };
    };
    window.__state = () => ({ aim: G.aim, club: G.club, ball: T.ballScreen().map(v => +v.toFixed(2)), look: T.look(), map: G.map, mode: G.mode, swing: !!G.swing, grid: !!(T.world.grid && T.world.grid.visible), dots: !!(T.world.dots && T.world.dots.visible), marker: T.lookMarker(), hudTop: !document.getElementById('hudTop').hidden, hudBot: !document.getElementById('hudBot').hidden, lookBtn: !document.getElementById('btnLook').hidden, camPos: T.camera.position.toArray().map(v => +v.toFixed(2)) });
  });
  const shot = async (name) => { await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => { window.__tempo.tick(0, true); requestAnimationFrame(() => res()); }))); await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 180000 }); };
  const R = { look: [], errors: errs };
  for (const kind of ['DR', '7I', 'putt']) {
    const r = { kind };
    r.place = await page.evaluate((k) => window.__put(k), kind);
    r.before = await page.evaluate(() => window.__state());
    await shot('look_' + kind + '_0address');
    r.inFrames = await page.evaluate(() => { const T = window.__tempo; document.getElementById('btnLook').dispatchEvent(new MouseEvent('click', { bubbles: true })); let n = 0; while (n < 200) { window.__tick(1); n++; const l = T.look(); if (l && l.phase === 'on') break; } return n; });
    r.on = await page.evaluate(() => window.__state());
    await shot('look_' + kind + '_1on');
    // pan: one finger 80 px left and 60 px down; a pull straight down must not swing
    r.pan = await page.evaluate(() => { const T = window.__tempo, l0 = T.look(); window.__ev('pointerdown', 200, 400); for (let i = 1; i <= 8; i++) { window.__ev('pointermove', 200 - 10 * i, 400 + 7.5 * i); window.__tick(1); } window.__ev('pointerup', 120, 460); window.__tick(2); const l1 = T.look(); return { before: [l0.px, l0.pz], after: [+l1.px.toFixed(2), +l1.pz.toFixed(2)], swing: !!T.G.swing, mode: T.G.mode }; });
    r.pinch = await page.evaluate(() => { const T = window.__tempo, z0 = T.look().zoom; window.__ev('pointerdown', 150, 450, 5); window.__ev('pointerdown', 240, 450, 6); for (let i = 1; i <= 8; i++) { window.__ev('pointermove', 150 - 6 * i, 450, 5); window.__ev('pointermove', 240 + 6 * i, 450, 6); window.__tick(1); } window.__ev('pointerup', 102, 450, 5); window.__ev('pointerup', 288, 450, 6); window.__tick(2); return { before: z0, after: +T.look().zoom.toFixed(3) }; });
    await shot('look_' + kind + '_2panzoom');
    r.pullDown = await page.evaluate(() => { const T = window.__tempo, G = T.G; window.__ev('pointerdown', 195, 600); for (let i = 1; i <= 10; i++) { window.__ev('pointermove', 195, 600 + 15 * i); window.__tick(1); } const s = !!G.swing || G.mode === 'swing'; window.__ev('pointerup', 195, 750); window.__tick(2); return { swingStarted: s, mode: G.mode }; });
    r.outFrames = await page.evaluate(() => { const T = window.__tempo; document.getElementById('btnLook').dispatchEvent(new MouseEvent('click', { bubbles: true })); let n = 0; while (n < 200) { window.__tick(1); n++; if (!T.look()) break; } return n; });
    r.lookLast = await page.evaluate(() => window.__tempo.lookLast());
    r.after = await page.evaluate(() => { window.__tick(10); return window.__state(); });
    r.unchanged = { aim: r.after.aim === r.before.aim, club: r.after.club === r.before.club, ballDx: +(r.after.ball[0] - r.before.ball[0]).toFixed(2), ballDy: +(r.after.ball[1] - r.before.ball[1]).toFixed(2) };
    await shot('look_' + kind + '_3back');
    R.look.push(r);
  }
  // ---- map: taps, drag, pinch ----
  await page.evaluate(() => window.__put('7I'));
  R.map = await page.evaluate(() => {
    const T = window.__tempo, G = T.G, out = {};
    document.getElementById('btnMap').dispatchEvent(new MouseEvent('click', { bubbles: true })); window.__tick(90);
    const a0 = G.aim, c0 = G.club; out.map = G.map;
    out.taps = [];
    for (const [x, y] of [[195, 300], [120, 500], [300, 650], [195, 200]]) { window.__ev('pointerdown', x, y); window.__tick(2); window.__ev('pointerup', x, y); window.__tick(5); out.taps.push({ x, y, aimChanged: G.aim !== a0, clubChanged: G.club !== c0 }); }
    const v0 = Object.assign({}, G.view), c0p = T.camera.position.clone();
    window.__ev('pointerdown', 200, 400); for (let i = 1; i <= 8; i++) { window.__ev('pointermove', 200 + 10 * i, 400 + 10 * i); window.__tick(1); } window.__ev('pointerup', 280, 480); window.__tick(30);
    out.drag = { view: [+G.view.px.toFixed(2), +G.view.pz.toFixed(2)], camMoved: +T.camera.position.distanceTo(c0p).toFixed(2), aimChanged: G.aim !== a0, clubChanged: G.club !== c0 };
    const z0 = G.view.zoom; window.__ev('pointerdown', 150, 450, 5); window.__ev('pointerdown', 240, 450, 6); for (let i = 1; i <= 8; i++) { window.__ev('pointermove', 150 + 4 * i, 450, 5); window.__ev('pointermove', 240 - 4 * i, 450, 6); window.__tick(1); } window.__ev('pointerup', 182, 450, 5); window.__ev('pointerup', 208, 450, 6); window.__tick(30);
    out.pinch = { zoom: [z0, +G.view.zoom.toFixed(3)], aimChanged: G.aim !== a0, clubChanged: G.club !== c0 };
    out.hint = !!document.getElementById('maphint');
    return out;
  });
  await shot('map_pan_zoom');
  await page.evaluate(() => { document.getElementById('btnMap').dispatchEvent(new MouseEvent('click', { bubbles: true })); window.__tick(90); });
  // ---- beam ----
  await page.evaluate(() => window.__put('DR'));
  R.beam = {};
  R.beam.rest = await page.evaluate(() => ({ beam: window.__tempo.beamOn() }));
  await shot('beam_0rest');
  R.beam.mid = await page.evaluate(() => { window.__ev('pointerdown', 120, 330); for (let i = 1; i <= 12; i++) { window.__ev('pointermove', 120 + 7 * i, 330); window.__tick(1); } window.__tick(0, true); return { beam: window.__tempo.beamOn(), aim: window.__tempo.G.aim, camYaw: window.__tempo.camYaw() }; });
  await shot('beam_1drag');
  R.beam.after = await page.evaluate(() => { window.__ev('pointerup', 204, 330); window.__tick(18); return { beam: window.__tempo.beamOn(), t: window.__tempo.beamT() }; });
  await shot('beam_2after03');
  R.beam.gone = await page.evaluate(() => { window.__tick(45); return { beam: window.__tempo.beamOn(), t: window.__tempo.beamT() }; });
  await page.evaluate(() => window.__put('putt'));
  R.beam.putt = await page.evaluate(() => { window.__ev('pointerdown', 120, 330); for (let i = 1; i <= 12; i++) { window.__ev('pointermove', 120 + 5 * i, 330); window.__tick(1); } return { beam: window.__tempo.beamOn() }; });
  await shot('beam_3putt');
  await page.evaluate(() => { window.__ev('pointerup', 180, 330); window.__tick(5); });
  fs.writeFileSync(path.join(OUT, 'look6.json'), JSON.stringify(R, null, 1));
  for (const r of R.look) console.log(r.kind, JSON.stringify({ inFrames: r.inFrames, outFrames: r.outFrames, lookLast: r.lookLast, on: { grid: r.on.grid, dots: r.on.dots, marker: r.on.marker, hudTop: r.on.hudTop, hudBot: r.on.hudBot, lookBtn: r.on.lookBtn }, pan: r.pan, pinch: r.pinch, pullDown: r.pullDown, unchanged: r.unchanged }));
  console.log('map', JSON.stringify(R.map)); console.log('beam', JSON.stringify(R.beam)); console.log('errors', errs);
  await browser.close();
})();
